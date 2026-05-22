import { Module } from '@nestjs/common';
import { SosController, AdminSosController } from './sos.controller';
import { SosService } from './sos.service';
import { SosGateway } from './sos.gateway';
import { RealtimeModule } from '../../common/realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [SosController, AdminSosController],
  providers: [SosService, SosGateway],
})
export class SosModule {}
