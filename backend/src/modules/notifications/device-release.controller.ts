import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DevicesService } from './devices.service';

class ReleaseDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}

/**
 * Detach a phone's push token from whoever was signed in on it, without a
 * session.
 *
 * When a session ends on its own (refresh token expired or revoked), the app
 * can no longer make authenticated calls, so the Device row stayed with the
 * old user and their visitor and SOS alerts kept arriving on a phone that was
 * signed out. Holding the push token is the proof: it exists only on that
 * device and in our database.
 */
@ApiTags('notifications')
@Controller('notifications/devices')
export class DeviceReleaseController {
  constructor(private devices: DevicesService) {}

  @Post('release')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  release(@Body() dto: ReleaseDeviceDto) {
    return this.devices.releaseDevice(dto.token);
  }
}
