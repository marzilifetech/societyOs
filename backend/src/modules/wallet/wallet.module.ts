import { Module } from '@nestjs/common';
import { WalletController, AdminWalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WalletController, AdminWalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
