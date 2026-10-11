import { Module } from '@nestjs/common';
import { HelpRequestController, StaffHelpRequestController } from './help-request.controller';
import { HelpRequestService } from './help-request.service';
import { StaffHelpService } from './staff-help.service';

@Module({
  controllers: [HelpRequestController, StaffHelpRequestController],
  providers: [HelpRequestService, StaffHelpService],
  exports: [HelpRequestService, StaffHelpService],
})
export class HelpRequestModule {}
