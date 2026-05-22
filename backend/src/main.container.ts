import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoBootstrapLogger } from 'nestjs-pino';
import * as compression from 'compression';
import helmet from 'helmet';
import { json, raw, urlencoded } from 'express';
import { AppModule } from './app.module';
import { initSentry, flushSentry } from './common/logging/sentry';
import { buildHelmetOptions } from './common/config/helmet.config';
import { buildCorsOptions } from './common/config/cors.config';
import { setupSwagger } from './common/config/swagger.config';
import { shutdownState } from './common/health/health.controller';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Replace default Nest logger with Pino once the module is up.
  app.useLogger(app.get(PinoBootstrapLogger));

  const config = app.get(ConfigService);
  const isProd = config.get('NODE_ENV') === 'production';

  // Sentry — best-effort init (no-op if dsn missing or pkg not installed).
  initSentry(config);

  // Trust proxy: required behind ALB/Nginx for correct req.ip + X-Forwarded-For (N7).
  const expressApp: any = (app as any).getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Body parsing: 1 MB default; raw body for Razorpay webhook signature verify.
  // The actual controller route is `@Controller('maintenance') @Post('webhook')`,
  // versioned to `/v1/maintenance/webhook`. We also accept `/webhooks/razorpay`
  // (with and without v1) so the Razorpay dashboard URL can match either form.
  const bodyLimit = config.get<string>('BODY_LIMIT', '1mb');
  const rawWebhookPaths = [
    '/v1/maintenance/webhook',
    '/maintenance/webhook',
    '/v1/webhooks/razorpay',
    '/webhooks/razorpay',
  ];
  for (const p of rawWebhookPaths) {
    app.use(p, raw({ type: '*/*', limit: bodyLimit }));
  }
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.use(helmet(buildHelmetOptions(isProd)));
  app.use(compression());

  app.enableCors(buildCorsOptions(config.get<string>('CORS_ORIGINS', ''), isProd));

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  setupSwagger(app, config);

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  const server = await app.listen(port);
  const log = new Logger('Bootstrap');
  log.log(`SocietyOS backend running on port ${port} (env=${config.get('NODE_ENV')})`);

  // --- Graceful shutdown ---
  // SIGTERM → flip drain flag (5s grace) → close HTTP, drain queues, disconnect.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.warn(`Received ${signal} — beginning graceful shutdown`);

    // 1) Flip drain flag so health endpoints return 503 (LB pulls us out).
    shutdownState.draining = true;
    await new Promise((r) => setTimeout(r, 5000));

    // 2) Stop accepting new HTTP connections.
    try {
      server.close?.();
    } catch (e) {
      log.error(`server.close failed: ${(e as Error).message}`);
    }

    // 3) BullMQ queues drain (10s timeout) — soft hook: any registered Queue on app context.
    const drainTimeout = 10_000;
    try {
      const queues: any[] = (app as any).queues ?? [];
      await Promise.race([
        Promise.all(
          queues.map((q) =>
            q?.close ? q.close().catch(() => undefined) : undefined,
          ),
        ),
        new Promise((r) => setTimeout(r, drainTimeout)),
      ]);
    } catch (e) {
      log.error(`queue drain failed: ${(e as Error).message}`);
    }

    // 4) Socket.io close (RealtimeGateway exposes server). Best-effort.
    try {
      const io: any = (global as any).__io;
      if (io?.close) await new Promise<void>((res) => io.close(() => res()));
    } catch {
      /* ignore */
    }

    // 5) Nest close → triggers OnModuleDestroy across providers (Prisma disconnect, etc.)
    try {
      await app.close();
    } catch (e) {
      log.error(`app.close failed: ${(e as Error).message}`);
    }

    // 6) Flush Sentry.
    await flushSentry(2000);

    log.warn('Shutdown complete — exiting');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    log.error(`uncaughtException: ${err.message}`, err.stack);
    try {

      const Sentry = require('@sentry/node');
      Sentry.captureException?.(err);
    } catch {
      /* ignore */
    }
  });
  process.on('unhandledRejection', (reason: any) => {
    log.error(`unhandledRejection: ${reason?.message ?? reason}`);
    try {

      const Sentry = require('@sentry/node');
      Sentry.captureException?.(reason);
    } catch {
      /* ignore */
    }
  });
}

bootstrap().catch((err) => {

  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
