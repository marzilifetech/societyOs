import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { TranslateService } from './translate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

class TranslateDto {
  @ApiProperty()
  @IsString()
  @MinLength(0)
  @MaxLength(10_000)
  text: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  target: string;
}

@ApiTags('translate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('translate')
export class TranslateController {
  constructor(private translate: TranslateService) {}

  @Post()
  do(@Body() dto: TranslateDto) {
    return this.translate.translate(dto.text, dto.target);
  }
}
