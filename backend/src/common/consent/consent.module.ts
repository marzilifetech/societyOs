import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConsentService } from './consent.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
