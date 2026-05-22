import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResidentType {
  OWNER = 'OWNER',
  TENANT = 'TENANT',
}

export class UpdateResidentDto {
  @ApiPropertyOptional({ enum: ResidentType })
  @IsOptional()
  @IsEnum(ResidentType)
  residentType?: ResidentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flatId?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;
}

export class OnboardResidentDto {
  @ApiProperty()
  @IsString()
  flatId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ResidentType })
  @IsEnum(ResidentType)
  type: ResidentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiProperty()
  @IsBoolean()
  consentAccepted: boolean;
}
