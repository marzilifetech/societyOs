import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsNumber, IsPositive, Max, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DomesticHelpRole, DomesticAttendanceStatus } from '@prisma/client';
import { EnumLabel } from '../../../common/utils/dto-transforms';

/** The app offers "Security", which has no role of its own. */
const ROLE_ALIASES = { SECURITY: 'OTHER', HOUSEKEEPER: 'MAID', NANNY: 'OTHER' };

export class CreateDomesticHelpDto {
  @ApiProperty()
  @IsString()
  name: string;

  /** A label ("Cook") or the enum key; the shipped app sends labels. */
  @ApiProperty({ enum: DomesticHelpRole })
  @EnumLabel(ROLE_ALIASES)
  @IsEnum(DomesticHelpRole)
  role: DomesticHelpRole;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  gateAccess?: boolean;
}

export class UpdateDomesticHelpDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: DomesticHelpRole })
  @EnumLabel(ROLE_ALIASES)
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

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  gateAccess?: boolean;
}

export class MarkAttendanceDto {
  @ApiProperty()
  @IsDateString()
  date: string;

  /** Required unless `present` is sent (what the shipped app sends). */
  @ApiPropertyOptional({ enum: DomesticAttendanceStatus })
  @ValidateIf((o) => o.present === undefined || o.status !== undefined)
  @IsEnum(DomesticAttendanceStatus)
  status?: DomesticAttendanceStatus;

  @ApiPropertyOptional({ description: 'Shorthand for status PRESENT / ABSENT' })
  @IsBoolean()
  @IsOptional()
  present?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class LogSalaryPaymentDto {
  @ApiProperty({ description: 'Rupees paid to the helper' })
  @IsNumber()
  @IsPositive()
  @Max(10_000_000)
  amount: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  paidAt?: string;
}
