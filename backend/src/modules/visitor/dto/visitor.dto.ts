import { IsString, IsOptional, IsDateString, IsBoolean, IsArray, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVisitorDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  purpose?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vehicleNo?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  /**
   * Array of day abbreviations: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
   * Only used when isRecurring is true.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recurringDays?: string[];

  /** ISO date string. Recurring passes will not be regenerated after this date. */
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  recurringUntil?: string;
}

export class CheckInVisitorDto {
  @ApiProperty()
  @IsString()
  qrToken: string;
}

export class VisitorDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';
}

/**
 * Guard-created walk-in visitor: target resident is known (flat lookup at the
 * gate), but the resident has NOT pre-approved. Backend creates a PENDING row
 * and fires an actionable push to the resident (Approve/Reject from lockscreen).
 */
export class CreateAtGateVisitorDto {
  @ApiProperty({ description: 'Resident.id who the visitor is here to see.' })
  @IsString()
  residentId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  purpose?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vehicleNo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photoUrl?: string;
}
