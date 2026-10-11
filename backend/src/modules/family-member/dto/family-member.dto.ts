import { IsString, IsOptional, IsBoolean, IsObject, IsDateString, IsIn, MaxLength } from 'class-validator';
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

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Fields the resident app's add/edit form sends besides the basics. */
class FamilyMemberDetailsDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: BLOOD_GROUPS })
  @IsIn(BLOOD_GROUPS)
  @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isEmergencyContact?: boolean;
}

export class CreateFamilyMemberDto extends FamilyMemberDetailsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiProperty()
  @IsString()
  relationship: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @Type(() => PermissionsDto)
  permissions?: PermissionsDto;
}

export class UpdateFamilyMemberDto extends FamilyMemberDetailsDto {
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
