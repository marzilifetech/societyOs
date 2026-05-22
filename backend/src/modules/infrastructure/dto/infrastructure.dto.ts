import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InfrastructureStatus } from '@prisma/client';

export class ReportIncidentDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photoUrl?: string;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: InfrastructureStatus })
  @IsEnum(InfrastructureStatus)
  status: InfrastructureStatus;
}

export class ResolveIncidentDto {
  @ApiProperty()
  @IsString()
  resolution: string;
}
