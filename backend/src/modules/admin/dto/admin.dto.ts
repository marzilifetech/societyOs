import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Centralised admin DTOs — the five highest-risk free-form `@Body() dto: {...}`
 * endpoints have been migrated here so the global ValidationPipe enforces
 * shape + types before the service ever sees the payload.
 *
 * Why these five (and not all 30+ in admin.controller.ts):
 *   - updateSociety / updateSocietyAdmin: tenant config + contact details —
 *     a typo or wrong type silently corrupts a society record.
 *   - createSociety: onboarding — the only path that mints new tenants.
 *   - createStaff: writes a User row with a phone number (uniqueness gate
 *     downstream); a missing field or wrong shape used to crash with a
 *     Prisma 500 instead of a useful 400.
 *   - sendPushNotification: fan-outs to N users; bad shapes mean wasted
 *     pushes or partial blasts.
 *   - addSosRecipient: writes into a JSON config blob with no DB validation.
 */

class EmergencyContactDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  relation?: string;
}

export class UpdateSocietyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'pincode must be 4–8 digits' })
  pincode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInDirectory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  designation: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  salary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ type: EmergencyContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;
}

export class SendPushNotificationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;

  @ApiProperty({ enum: ['ALL', 'FLAT', 'BLOCK', 'INDIVIDUAL'] })
  @IsIn(['ALL', 'FLAT', 'BLOCK', 'INDIVIDUAL'])
  targetType: 'ALL' | 'FLAT' | 'BLOCK' | 'INDIVIDUAL';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class AddSosRecipientDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  role?: string;
}

export class CreateSocietyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  city: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'pincode must be 4–8 digits' })
  pincode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInDirectory?: boolean;

  @ApiPropertyOptional({ description: 'Public contact email shown to residents' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Public contact phone shown to residents' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({
    description: 'Unique onboarding / join code (letters, numbers, dashes). Auto-uppercased.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{2,20}$/, {
    message: 'shortCode must be 2–20 letters, numbers, or dashes',
  })
  shortCode?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  adminPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flatsCsv?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentsCsv?: string;
}

/**
 * Society maintenance rate card. Bill generation previously hardcoded a base
 * amount of 0, so every generated bill was for zero rupees; the rate now comes
 * from here. Every field is optional so the screen can PATCH-style save one
 * setting at a time.
 */
export class UpdateMaintenanceRateDto {
  @ApiPropertyOptional({ enum: ['FLAT', 'PER_SQFT'] })
  @IsOptional()
  @IsIn(['FLAT', 'PER_SQFT'])
  mode?: 'FLAT' | 'PER_SQFT';

  @ApiPropertyOptional({ description: 'Amount charged per unit when mode = FLAT' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatRate?: number;

  @ApiPropertyOptional({ description: 'Multiplied by flat.areaSqft when mode = PER_SQFT' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ratePerSqft?: number;

  @ApiPropertyOptional({ description: 'Day of month the bill falls due (1-28)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay?: number;

  @ApiPropertyOptional({ description: 'Per-flat amount overrides keyed by flatId' })
  @IsOptional()
  @IsObject()
  overrides?: Record<string, number>;
}
