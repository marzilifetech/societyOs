import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';

const SWAGGER_PATH = 'api/docs';

function basicAuth(user: string, pass: string) {
  const expected = Buffer.from(`${user}:${pass}`).toString('base64');
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    if (header === `Basic ${expected}`) return next();
    res.setHeader('WWW-Authenticate', 'Basic realm="docs"');
    res.status(401).send('Authentication required');
  };
}

export function setupSwagger(app: INestApplication, config: ConfigService) {
  const env = config.get<string>('NODE_ENV', 'development');
  const isProd = env === 'production';
  const swaggerUser = config.get<string>('SWAGGER_USER');
  const swaggerPass = config.get<string>('SWAGGER_PASS');

  // In prod: require basic-auth credentials. If unset, skip Swagger entirely.
  if (isProd) {
    if (!swaggerUser || !swaggerPass) {
      // Swagger is gated off in prod when credentials are not provided.
      return;
    }
    const expressApp: any = (app as any).getHttpAdapter().getInstance();
    expressApp.use(`/${SWAGGER_PATH}`, basicAuth(swaggerUser, swaggerPass));
  }

  const cfg = new DocumentBuilder()
    .setTitle('SocietyOS API')
    .setDescription('Backend API for SocietyOS platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, cfg);
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
