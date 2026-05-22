import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class VendorOrderItemDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateVendorOrderDto {
  @ApiProperty({ type: [VendorOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorOrderItemDto)
  items: VendorOrderItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2025-06-15T14:00:00Z' })
  @IsOptional()
  @IsDateString()
  deliveryAt?: string;
}

export enum VendorOrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class UpdateVendorOrderStatusDto {
  @ApiProperty({ enum: VendorOrderStatus })
  @IsEnum(VendorOrderStatus)
  status: VendorOrderStatus;
}
