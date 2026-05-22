import { Module } from '@nestjs/common';
import { DomesticHelpController } from './domestic-help.controller';
import { DomesticHelpService } from './domestic-help.service';

@Module({
  controllers: [DomesticHelpController],
  providers: [DomesticHelpService],
})
export class DomesticHelpModule {}
