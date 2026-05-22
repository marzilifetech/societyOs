import { Module } from '@nestjs/common';
import { AgmController } from './agm.controller';
import { AgmService } from './agm.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AgmController],
  providers: [AgmService],
})
export class AgmModule {}
