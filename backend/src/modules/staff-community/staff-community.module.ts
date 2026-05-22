import { Module } from '@nestjs/common';
import { StaffCommunityController } from './staff-community.controller';
import { StaffCommunityService } from './staff-community.service';

@Module({
  controllers: [StaffCommunityController],
  providers: [StaffCommunityService],
  exports: [StaffCommunityService],
})
export class StaffCommunityModule {}
