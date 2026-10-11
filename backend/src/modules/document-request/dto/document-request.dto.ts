import { IsString, IsOptional, IsDateString, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentRequestType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateDocumentRequestDto {
  /**
   * A DocumentRequestType, or the label the shipped app sends ("Possession
   * Letter"); see `documentTypeFor`. Every request from the app was a 400.
   */
  @ApiProperty({ enum: DocumentRequestType })
  @IsString()
  @MaxLength(60)
  type: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  purpose?: string;

  /** What the shipped app calls `purpose`. */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  requiredBy?: string;
}

export class RateDocumentRequestDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  /** Sent by the shipped app; there is nowhere to keep it yet, so it is accepted and dropped. */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  comment?: string;
}
