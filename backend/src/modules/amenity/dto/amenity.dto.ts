import { IsString, IsOptional, IsInt, IsDateString, IsNumber, Min, Max, IsBoolean, Length, Matches, ValidateIf, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateAmenityDto {
  @ApiProperty()
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'openTime must be HH:mm (24h)' })
  openTime: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'closeTime must be HH:mm (24h)' })
  closeTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(720)
  @Type(() => Number)
  slotDurationMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerSlot?: number;
}

export class UpdateAmenityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'openTime must be HH:mm (24h)' })
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'closeTime must be HH:mm (24h)' })
  closeTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(720)
  @Type(() => Number)
  slotDurationMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerSlot?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** An end time may be midnight at the end of the day (the app's last slot ends "24:00"). */
const END_HHMM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export class CreateAmenityBookingDto {
  @ApiProperty()
  @IsString()
  amenityId: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty({ example: '18:00' })
  @ValidateIf((o) => o.startTime === undefined || o.startSlot !== undefined)
  @Matches(HHMM)
  startSlot: string;

  @ApiProperty({ example: '19:00' })
  @ValidateIf((o) => o.endTime === undefined || o.endSlot !== undefined)
  @Matches(END_HHMM)
  endSlot: string;

  // The shipped app's names for the slots, and a note. Every booking from it
  // was a 400 because these were unknown fields.
  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @Matches(HHMM)
  startTime?: string;

  @ApiPropertyOptional({ example: '19:00' })
  @IsOptional()
  @Matches(END_HHMM)
  endTime?: string;

  /** Accepted from the app; bookings have no notes column yet. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  guestCount?: number;
}

export class RateAmenityBookingDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ratingText?: string;
}
