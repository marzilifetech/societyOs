import { IsString, IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestGuestParkingDto {
  @ApiProperty()
  @IsString()
  vehiclePlate: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  visitorName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReportUnauthorizedDto {
  @ApiProperty()
  @IsString()
  vehiclePlate: string;

  @ApiProperty()
  @IsString()
  slotNumber: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class GuestParkingRequestDto {
  @ApiProperty()
  @IsString()
  visitorName: string;

  @ApiProperty()
  @IsString()
  vehicleNumber: string;

  @ApiProperty({ description: 'Date in ISO format (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Duration in hours', minimum: 1, maximum: 72 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  duration: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
