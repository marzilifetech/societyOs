import { Module } from '@nestjs/common';
import { FamilyMemberController } from './family-member.controller';
import { FamilyMemberService } from './family-member.service';

@Module({
  controllers: [FamilyMemberController],
  providers: [FamilyMemberService],
})
export class FamilyMemberModule {}
