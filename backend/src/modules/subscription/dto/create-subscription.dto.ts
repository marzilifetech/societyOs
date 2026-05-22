import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsObject } from 'class-validator';
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

  @ApiProperty()
  @IsDateString()
  startDate: string;

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
