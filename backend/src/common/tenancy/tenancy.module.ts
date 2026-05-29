import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TenantMiddleware } from './tenant.middleware';

// AuthRedis is provided globally by JwtCoreModule (see common/auth/jwt-core.module.ts),
// so the middleware can resolve it without an explicit import here.
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
    }),
  ],
  providers: [TenantMiddleware],
  exports: [TenantMiddleware],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
