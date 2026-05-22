import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum HousekeepingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class UpdateHousekeepingStatusDto {
  @ApiProperty({ enum: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] })
  @IsEnum(HousekeepingStatus)
  status: HousekeepingStatus;
}
