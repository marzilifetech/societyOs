import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsObject, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionFrequency } from '@prisma/client';

export class CreateSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  items?: Record<string, unknown>[];

  @ApiProperty({ enum: SubscriptionFrequency, default: SubscriptionFrequency.DAILY })
  @IsEnum(SubscriptionFrequency)
  frequency: SubscriptionFrequency;

  /** Defaults to today (IST) — the shipped app never sends it. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  // The shipped app describes a subscription as one line — what, from whom,
  // how many — instead of `items`. Stored as the single item.
  @ApiPropertyOptional({ example: 'MILK' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class PauseSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  pauseUntil?: string;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
