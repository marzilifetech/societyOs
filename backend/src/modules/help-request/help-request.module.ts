import { Module } from '@nestjs/common';
import { HelpRequestController, StaffHelpRequestController } from './help-request.controller';
import { HelpRequestService } from './help-request.service';

@Module({
  controllers: [HelpRequestController, StaffHelpRequestController],
  providers: [HelpRequestService],
  exports: [HelpRequestService],
})
export class HelpRequestModule {}
