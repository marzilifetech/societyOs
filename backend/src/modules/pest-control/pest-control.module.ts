import { Module } from '@nestjs/common';
import { PestControlController } from './pest-control.controller';
import { PestControlService } from './pest-control.service';

@Module({
  controllers: [PestControlController],
  providers: [PestControlService],
})
export class PestControlModule {}
