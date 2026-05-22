import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

const PII_REDACT_PATHS = [
  // Headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  // Body / response PII
  '*.phone',
  '*.email',
  '*.aadhaar',
  '*.password',
  '*.totpSecret',
  '*.otp',
  '*.token',
  '*.refreshToken',
  '*.fcmToken',
  // Nested
  '*.*.phone',
  '*.*.email',
  '*.*.aadhaar',
  '*.*.password',
  '*.*.totpSecret',
];

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', isProd ? 'info' : 'debug'),
            // Use the request id set by RequestIdMiddleware
            genReqId: (req: any, _res: any) => req.id ?? req.headers['x-request-id'],
            customProps: (req: Request) => ({
              requestId: (req as any).id,
            }),
            redact: {
              paths: PII_REDACT_PATHS,
              censor: '[REDACTED]',
              remove: false,
            },
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                },
            // Skip noise on health/metrics
            autoLogging: {
              ignore: (req: any) =>
                req.url === '/health' ||
                req.url === '/readyz' ||
                req.url?.startsWith('/api/docs'),
            },
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}
