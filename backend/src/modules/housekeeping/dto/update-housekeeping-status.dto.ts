import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum HousekeepingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Status change from the staff app, optionally carrying completion evidence.
 *
 * The app has always sent `beforePhotoUrl`, `afterPhotoUrl` and `notes`
 * alongside the COMPLETED status. This DTO declared only `status`, and the
 * global ValidationPipe runs with `forbidNonWhitelisted: true`, so every
 * completion was rejected with `400 property beforePhotoUrl should not exist`
 * — the housekeeper could not finish the job, and the two photos they had just
 * taken were thrown away.
 */
export class UpdateHousekeepingStatusDto {
  @ApiProperty({ enum: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] })
  @IsEnum(HousekeepingStatus)
  status: HousekeepingStatus;

  @ApiPropertyOptional({ description: 'Photo taken before work started' })
  @IsOptional()
  @IsString()
  beforePhotoUrl?: string;

  @ApiPropertyOptional({ description: 'Photo taken after work finished' })
  @IsOptional()
  @IsString()
  afterPhotoUrl?: string;

  @ApiPropertyOptional({ description: "Staff member's completion note" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
