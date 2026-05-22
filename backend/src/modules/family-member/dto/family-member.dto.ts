import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PermissionsDto {
  @IsBoolean()
  @IsOptional()
  sosAlerts?: boolean;

  @IsBoolean()
  @IsOptional()
  visitorApproval?: boolean;

  @IsBoolean()
  @IsOptional()
  paymentAlerts?: boolean;
}

export class CreateFamilyMemberDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  relationship: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @Type(() => PermissionsDto)
  permissions?: PermissionsDto;
}

export class UpdateFamilyMemberDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  relationship?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @Type(() => PermissionsDto)
  permissions?: PermissionsDto;
}
