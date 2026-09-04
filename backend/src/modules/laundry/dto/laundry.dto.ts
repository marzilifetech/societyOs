import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Evidence captured when laundry is collected.
 *
 * Both fields are optional so a pickup can still be recorded when the camera
 * was unavailable or the count was not taken — refusing the pickup outright
 * would leave the booking stuck, which is worse than a pickup without a photo.
 * The endpoint previously declared no body at all, so both were silently
 * discarded.
 */
export class MarkPickedUpDto {
  @ApiPropertyOptional({ description: 'Photo taken at collection' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'Garments actually collected' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  garmentCount?: number;
}
