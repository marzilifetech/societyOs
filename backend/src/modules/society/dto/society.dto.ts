import { IsString, IsOptional, IsObject, IsInt, IsNumber, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateSocietyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

// ─── Budget DTOs ──────────────────────────────────────────────────────────────

export class BudgetLineItemDto {
  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsNumber()
  allocated: number;
}

export class CreateSocietyBudgetDto {
  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Max(2100)
  month: number;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty()
  @IsNumber()
  totalIncome: number;

  @ApiPropertyOptional({ type: [BudgetLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineItemDto)
  lineItems?: BudgetLineItemDto[];
}

export class UpdateSocietyBudgetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalIncome?: number;

  @ApiPropertyOptional({ type: [BudgetLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineItemDto)
  lineItems?: BudgetLineItemDto[];
}

export class BudgetQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;
}

// ─── Bylaw DTOs ───────────────────────────────────────────────────────────────

export class CreateBylawDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  section: string;

  @ApiProperty()
  @IsString()
  content: string;
}

export class UpdateBylawDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}

export class UpdateConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
