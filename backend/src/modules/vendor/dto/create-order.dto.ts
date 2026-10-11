import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
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
  @ValidateIf((o) => o.price === undefined || o.unitPrice !== undefined)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  /** What the shipped app calls `unitPrice`; either is accepted. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
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

  /** What the shipped app calls `deliveryAt` (a date, YYYY-MM-DD). */
  @ApiPropertyOptional({ example: '2025-06-15' })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;
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
