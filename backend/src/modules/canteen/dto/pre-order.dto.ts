import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PreOrderItemDto {
  @ApiProperty()
  @IsString()
  dishId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreatePreOrderDto {
  @ApiProperty({ type: [PreOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreOrderItemDto)
  items: PreOrderItemDto[];

  @ApiProperty({ example: '2025-06-15T12:30:00Z' })
  @IsDateString()
  pickupAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export enum PreOrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  READY = 'READY',
  COLLECTED = 'COLLECTED',
  CANCELLED = 'CANCELLED',
}

export class UpdatePreOrderStatusDto {
  @ApiProperty({ enum: PreOrderStatus })
  @IsEnum(PreOrderStatus)
  status: PreOrderStatus;
}
