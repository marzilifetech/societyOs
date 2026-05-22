import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentRequestType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateDocumentRequestDto {
  @ApiProperty({ enum: DocumentRequestType })
  @IsEnum(DocumentRequestType)
  type: DocumentRequestType;

  @ApiProperty()
  @IsString()
  purpose: string;

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
}
