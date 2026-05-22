import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DomesticHelpRole, DomesticAttendanceStatus } from '@prisma/client';

export class CreateDomesticHelpDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: DomesticHelpRole })
  @IsEnum(DomesticHelpRole)
  role: DomesticHelpRole;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photoUrl?: string;
}

export class UpdateDomesticHelpDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: DomesticHelpRole })
  @IsEnum(DomesticHelpRole)
  @IsOptional()
  role?: DomesticHelpRole;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class MarkAttendanceDto {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty({ enum: DomesticAttendanceStatus })
  @IsEnum(DomesticAttendanceStatus)
  status: DomesticAttendanceStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
