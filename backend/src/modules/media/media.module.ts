import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MediaController } from './media.controller';
import { MarziMediaClient } from './marzi-media.client';

/**
 * Proxy module for the external Marzi media service. AuthRedis (which holds the
 * parked Marzi access token) is provided globally by JwtCoreModule, so it does
 * not need re-importing here.
 */
@Module({
  imports: [HttpModule], // outbound HTTP to the Marzi media API
  controllers: [MediaController],
  providers: [MarziMediaClient],
  exports: [MarziMediaClient],
})
export class MediaModule {}
