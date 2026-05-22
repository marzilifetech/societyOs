import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum HelpUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export class CreateHelpRequestDto {
  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: HelpUrgency, default: HelpUrgency.MEDIUM })
  @IsEnum(HelpUrgency)
  @IsOptional()
  urgency?: HelpUrgency;
}

export class UpdateHelpRequestStatusDto {
  @ApiProperty({ enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @IsEnum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}
