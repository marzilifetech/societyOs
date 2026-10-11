import { IsString, IsOptional, IsBoolean, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  photoUrls?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;

  /**
   * Sent by the shipped app; posts have no category column yet, so it is
   * accepted and not stored. (Rejecting it made every new post a 400.)
   */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(40)
  category?: string;
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  content: string;
}
