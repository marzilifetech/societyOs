// Dynamic AppModule factory + serverless-express bootstrap.
//
// Each Lambda handler calls `createLambdaApp('core-identity')` (etc.); we build
// a NestJS app containing only the modules for that group plus the cross-cutting
// providers (Prisma, Storage, Health, Throttler, global pipes/filters/interceptors).
//
// The Nest app is cached across warm invocations — we bootstrap once per
// container lifetime, not per request. See plan §1.

import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { json, raw, urlencoded } from 'express';
import type { Express } from 'express';

import { configure as serverlessExpress } from '@vendia/serverless-express';

import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../common/storage/storage.module';
import { HealthModule } from '../common/health/health.module';
import { JwtCoreModule } from '../common/auth/jwt-core.module';
import { AppLoggerModule } from '../common/logging/logger.module';
import { envValidationSchema } from '../common/config/env.validation';
import {
  AppThrottlerGuard,
  throttlerOptions,
} from '../common/config/throttler.config';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor';
import { RequestLoggingInterceptor } from '../common/interceptors/request-logging.interceptor';
import { GlobalExceptionFilter } from '../common/filters/http-exception.filter';
import { RequestIdMiddleware } from '../common/middleware/request-id.middleware';

import { LambdaPushModule } from './lambda-push.module';
import { LambdaRealtimeModule } from './lambda-realtime.module';
import { MODULE_GROUPS, type LambdaName } from './module-groups';

function buildAppModule(featureModules: Type<unknown>[]): DynamicModule {
  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        validationSchema: envValidationSchema,
        validationOptions: { allowUnknown: true, abortEarly: false },
      }),
      AppLoggerModule,
      ThrottlerModule.forRootAsync(throttlerOptions),
      PrismaModule,
      StorageModule,
      HealthModule,
      JwtCoreModule, // provides JwtStrategy so @UseGuards(JwtAuthGuard) works
      LambdaRealtimeModule,
      LambdaPushModule,
      ...featureModules,
    ],
    providers: [
      { provide: APP_GUARD, useClass: AppThrottlerGuard },
      { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
      { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
      { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    ],
  })
  class LambdaAppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      // ShutdownGuardMiddleware is container-only: Lambdas don't drain, they
      // just stop receiving invocations.
      consumer.apply(RequestIdMiddleware).forRoutes('*');
    }
  }
  return { module: LambdaAppModule };
}

// Razorpay webhook needs raw body for HMAC verification. We register raw()
// for these paths only; everything else uses json().
const RAW_BODY_PATHS = [
  '/v1/maintenance/webhook',
  '/maintenance/webhook',
  '/v1/webhooks/razorpay',
  '/webhooks/razorpay',
];

let cachedHandler: ReturnType<typeof serverlessExpress> | undefined;

export async function createLambdaApp(name: LambdaName) {
  process.env.LAMBDA_NAME = name;

  const featureModules = MODULE_GROUPS[name];
  if (!featureModules) {
    throw new Error(`Unknown LAMBDA_NAME: ${name}`);
  }

  const app = await NestFactory.create(buildAppModule(featureModules), {
    bufferLogs: true,
  });

  // Trust API Gateway → ALB → ... chain so req.ip resolves correctly.
  const expressInstance = app.getHttpAdapter().getInstance() as Express;
  expressInstance.set('trust proxy', true);

  const bodyLimit = process.env.BODY_LIMIT ?? '1mb';
  for (const p of RAW_BODY_PATHS) {
    app.use(p, raw({ type: '*/*', limit: bodyLimit }));
  }
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();
  return expressInstance;
}

export function makeHandler(name: LambdaName) {
  return async (event: unknown, context: unknown, callback: unknown) => {
    if (!cachedHandler) {
      const app = await createLambdaApp(name);
      cachedHandler = serverlessExpress({ app });
    }
    return cachedHandler(event as never, context as never, callback as never);
  };
}
