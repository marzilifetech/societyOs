import { IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum HousekeepingType {
  DEEP_CLEAN = 'DEEP_CLEAN',
  REGULAR = 'REGULAR',
  BATHROOM = 'BATHROOM',
  KITCHEN = 'KITCHEN',
  WINDOWS = 'WINDOWS',
}

export class CreateHousekeepingDto {
  @ApiProperty({ enum: HousekeepingType })
  @IsEnum(HousekeepingType)
  type: HousekeepingType;

  @ApiProperty()
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
