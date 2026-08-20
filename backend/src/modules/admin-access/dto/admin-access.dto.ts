import { IsArray, IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpsertAdminDto {
  /** 10-digit Indian mobile, with or without +91. */
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, { message: 'Enter a valid Indian mobile number' })
  phone!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsString()
  roleKey!: string;

  /** Empty/omitted = society-wide. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blocks?: string[];
}

export class CreateAdminRoleDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{2,31}$/, {
    message: 'key must be lowercase letters, digits and underscores',
  })
  key!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

export class SetAdminActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateAdminRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blocks?: string[];
}
