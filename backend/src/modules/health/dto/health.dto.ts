import { IsString, IsOptional, IsDateString, IsBoolean, IsEnum, IsArray, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { HealthVitalType, HealthRecordType } from '@prisma/client';

export class CreateVitalDto {
  @ApiProperty({ enum: HealthVitalType })
  @IsEnum(HealthVitalType)
  type: HealthVitalType;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  value: number;

  @ApiProperty()
  @IsString()
  unit: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty()
  @IsDateString()
  recordedAt: string;
}

export class CreateMedicationDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  dosage: string;

  @ApiProperty()
  @IsString()
  frequency: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  reminderTimes?: string[];
}

export class UpdateMedicationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dosage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  frequency?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  reminderTimes?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateHealthRecordDto {
  @ApiProperty({ enum: HealthRecordType })
  @IsEnum(HealthRecordType)
  type: HealthRecordType;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
