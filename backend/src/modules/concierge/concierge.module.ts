import { Module } from '@nestjs/common';
import { ConciergeController, ConciergeRequestsController } from './concierge.controller';
import { ConciergeService } from './concierge.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConciergeController, ConciergeRequestsController],
  providers: [ConciergeService],
  exports: [ConciergeService],
})
export class ConciergeModule {}
