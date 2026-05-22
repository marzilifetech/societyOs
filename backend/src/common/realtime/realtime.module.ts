import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { EventsGateway } from './events.gateway';
import { RealtimeController } from './realtime.controller';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RealtimeController],
  providers: [RealtimeGateway, EventsGateway],
  exports: [RealtimeGateway, EventsGateway],
})
export class RealtimeModule {}
