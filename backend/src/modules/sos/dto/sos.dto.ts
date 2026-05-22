import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TriggerSosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

/** PATCH /sos/:id/note — add context after the alert was created. */
export class SosNoteUpdateDto {
  @ApiProperty({ description: 'Context for security (appended to any existing note).' })
  @IsString()
  @MaxLength(2000)
  note!: string;
}
