import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Push token for the device (FCM/APNs/web).' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';

  @ApiPropertyOptional({ description: "App flavour: 'resident' | 'staff' | 'admin'." })
  @IsOptional()
  @IsString()
  appType?: string;
}

export class PreferenceUpdateDto {
  @ApiProperty({ description: 'Notification category key (see registry).' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({ type: [PreferenceUpdateDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceUpdateDto)
  prefs!: PreferenceUpdateDto[];
}

export class InboxListQueryDto {
  @ApiPropertyOptional({ description: 'Pagination cursor (id of last item from previous page).' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Page size (1–50, default 20).' })
  @IsOptional()
  @IsString()
  limit?: string;
}
