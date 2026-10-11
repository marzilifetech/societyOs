import { IsString, IsOptional, IsBoolean, IsEnum, IsInt, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnumLabel } from '../../../common/utils/dto-transforms';

export enum ComplaintCategory {
  NOISE = 'NOISE',
  CLEANLINESS = 'CLEANLINESS',
  PARKING = 'PARKING',
  SECURITY = 'SECURITY',
  MAINTENANCE = 'MAINTENANCE',
  NEIGHBOR = 'NEIGHBOR',
  WATER = 'WATER',
  PETS = 'PETS',
  COMMUNITY = 'COMMUNITY',
  OTHER = 'OTHER',
}

export enum ComplaintStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

export class CreateComplaintDto {
  @ApiProperty({ enum: ComplaintCategory })
  @EnumLabel()
  @IsEnum(ComplaintCategory)
  category: ComplaintCategory;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  /**
   * A photo uploaded through /media. The app has always sent it; with no
   * field here every complaint with a photo was a 400.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  photoUrl?: string;
}

export class UpdateComplaintStatusDto {
  @ApiProperty({ enum: ComplaintStatus })
  @IsEnum(ComplaintStatus)
  status: ComplaintStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class RateComplaintDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
