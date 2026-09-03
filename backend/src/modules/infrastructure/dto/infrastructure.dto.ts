import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InfrastructureStatus, IncidentSeverity } from '@prisma/client';

/**
 * The admin "Report Incident" form has always collected a title and a severity
 * alongside the description. Those fields were never declared here, and the
 * global ValidationPipe runs with `forbidNonWhitelisted: true`, so every single
 * submission was rejected with `400 property title should not exist` — which is
 * exactly the "Infrastructure report feature is not functional" report.
 */
export class ReportIncidentDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(160)
  title?: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: IncidentSeverity })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

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

/**
 * `resolution` is optional: the Resolve button on the incidents list posts an
 * empty body, and requiring a note there made every click 400. A default note
 * is recorded when the caller supplies none.
 */
export class ResolveIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolution?: string;
}
