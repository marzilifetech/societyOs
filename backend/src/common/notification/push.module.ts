import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PushService } from './push.service';
import { WhatsAppService } from './whatsapp.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PushService, WhatsAppService],
  exports: [PushService, WhatsAppService],
})
export class PushModule {}
