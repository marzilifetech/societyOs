import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
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

/**
 * A laundry booking. Accepts the API's `{scheduledAt, type, itemCount}` and the
 * resident app's `{date, timeSlot, type}` with its own type names; the body
 * used to be unvalidated, so the app's request reached Prisma and failed (500).
 */
export class CreateLaundryBookingDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  /** YYYY-MM-DD (IST), with `timeSlot`. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  /** HH:MM (IST), with `date`. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  timeSlot?: string;

  @IsString()
  @MaxLength(30)
  type: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  itemCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
