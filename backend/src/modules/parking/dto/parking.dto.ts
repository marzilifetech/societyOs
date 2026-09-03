import { IsString, IsOptional, IsDateString, IsInt, Min, Max, MaxLength } from 'class-validator';
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

/**
 * Gate-side guest parking, logged by an admin or security staff member.
 *
 * Deliberately distinct from `RequestGuestParkingDto` (a resident pre-announcing
 * a guest): there is no host resident to resolve, so the admin dashboard can
 * actually use it. `flatLabel` is free text because the gate usually has a flat
 * number written on a slip, not a Flat row id.
 */
export class LogGuestParkingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(20)
  vehiclePlate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  visitorName?: string;

  @ApiPropertyOptional({ description: 'Flat being visited, e.g. "A-402"' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  flatLabel?: string;

  @ApiPropertyOptional({ description: 'Specific visitor bay; auto-assigned when omitted' })
  @IsOptional()
  @IsString()
  slotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
