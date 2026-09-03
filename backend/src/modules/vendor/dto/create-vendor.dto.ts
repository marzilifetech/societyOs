import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VendorCategory {
  GROCERY = 'GROCERY',
  PHARMACY = 'PHARMACY',
  BAKERY = 'BAKERY',
  DAIRY = 'DAIRY',
  VEGETABLES = 'VEGETABLES',
  // Categories the admin dashboard has always offered in its dropdown but the
  // enum never accepted, so "Add Vendor" 400'd on every one of them.
  RESTAURANT = 'RESTAURANT',
  LAUNDRY = 'LAUNDRY',
  CLEANING = 'CLEANING',
  PLUMBER = 'PLUMBER',
  ELECTRICIAN = 'ELECTRICIAN',
  CARPENTER = 'CARPENTER',
  SECURITY = 'SECURITY',
  OTHER = 'OTHER',
}

/**
 * Normalises the category a client sends. The dashboard sent Title Case
 * ("Grocery", "Restaurant"); this enum is UPPER_SNAKE. Rather than break every
 * already-shipped client, fold case and whitespace here and fall back to OTHER
 * for anything unrecognised — an unfamiliar category is not a reason to refuse
 * to save a vendor.
 */
export function normaliseVendorCategory(value: unknown): VendorCategory {
  if (typeof value !== 'string') return VendorCategory.OTHER;
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (VendorCategory as Record<string, VendorCategory>)[key] ?? VendorCategory.OTHER;
}

export class CreateVendorDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: VendorCategory })
  @IsString()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVendorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: VendorCategory })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
