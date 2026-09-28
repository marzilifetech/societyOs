import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SosController, AdminSosController } from './sos.controller';
import { SosService } from './sos.service';
import { SosGateway } from './sos.gateway';
import { RealtimeModule } from '../../common/realtime/realtime.module';

@Module({
  imports: [
    RealtimeModule,
    // SosGateway verifies the socket's access token (same secret as the API).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ secret: config.get('JWT_SECRET') }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SosController, AdminSosController],
  providers: [SosService, SosGateway],
})
export class SosModule {}
