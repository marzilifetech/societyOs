import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PestControlType {
  MOSQUITO = 'MOSQUITO',
  COCKROACH = 'COCKROACH',
  RODENT = 'RODENT',
  TERMITE = 'TERMITE',
  GENERAL = 'GENERAL',
}

export class CreatePestControlDto {
  @ApiProperty({ enum: PestControlType })
  @IsEnum(PestControlType)
  type: PestControlType;

  @ApiProperty()
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  areas: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
