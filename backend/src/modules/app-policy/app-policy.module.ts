import { Module } from '@nestjs/common';
import { AppPolicyController } from './app-policy.controller';
import { AppPolicyService } from './app-policy.service';

@Module({
  controllers: [AppPolicyController],
  providers: [AppPolicyService],
})
export class AppPolicyModule {}
