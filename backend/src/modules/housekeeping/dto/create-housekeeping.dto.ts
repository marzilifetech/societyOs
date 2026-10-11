import { IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnumLabel } from '../../../common/utils/dto-transforms';

export enum HousekeepingType {
  DEEP_CLEAN = 'DEEP_CLEAN',
  REGULAR = 'REGULAR',
  BATHROOM = 'BATHROOM',
  KITCHEN = 'KITCHEN',
  WINDOWS = 'WINDOWS',
}

export class CreateHousekeepingDto {
  /** The shipped app sends the label ("Deep Clean"); both forms are accepted. */
  @ApiProperty({ enum: HousekeepingType })
  @EnumLabel()
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
