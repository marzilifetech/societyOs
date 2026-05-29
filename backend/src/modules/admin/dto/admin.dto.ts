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
  MaxLength,
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
