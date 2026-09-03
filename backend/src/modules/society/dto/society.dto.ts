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

/**
 * One budget head.
 *
 * The admin screen calls the label `name` and also carries a running `spent`;
 * the original DTO only accepted `category` + `allocated`. Because the global
 * ValidationPipe runs with `forbidNonWhitelisted: true`, every publish attempt
 * from the dashboard was rejected outright. Both spellings are accepted, and
 * `spent` is persisted so the Budget screen can show real utilisation instead
 * of a permanently blank column.
 */
export class BudgetLineItemDto {
  @ApiPropertyOptional({ description: 'Budget head. Alias of `name`.' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Budget head. Alias of `category`.' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocated: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  spent?: number;
}

/**
 * Publish a society budget.
 *
 * `month` is optional: the dashboard publishes an ANNUAL budget (its own copy
 * says "Publish and manage annual society budgets"), which is stored with
 * `month = 0`. The previous DTO required `month` and — via a copy-paste slip —
 * validated it with `@Min(2000) @Max(2100)`, so no legal month value could ever
 * pass. `totalBudget` is accepted as an alias of `totalIncome` and `breakdown`
 * as an alias of `lineItems`, which is what the screen actually sends.
 */
export class CreateSocietyBudgetDto {
  @ApiPropertyOptional({ description: '1-12 for a monthly budget; omit or 0 for an annual budget' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  month?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: 'Total budget. Alias of `totalBudget`.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalIncome?: number;

  @ApiPropertyOptional({ description: 'Total budget. Alias of `totalIncome`.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalBudget?: number;

  @ApiPropertyOptional({ type: [BudgetLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineItemDto)
  lineItems?: BudgetLineItemDto[];

  @ApiPropertyOptional({ type: [BudgetLineItemDto], description: 'Alias of `lineItems`.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineItemDto)
  breakdown?: BudgetLineItemDto[];
}

export class UpdateSocietyBudgetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalIncome?: number;

  @ApiPropertyOptional({ description: 'Alias of `totalIncome`.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalBudget?: number;

  @ApiPropertyOptional({ type: [BudgetLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineItemDto)
  lineItems?: BudgetLineItemDto[];

  @ApiPropertyOptional({ type: [BudgetLineItemDto], description: 'Alias of `lineItems`.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineItemDto)
  breakdown?: BudgetLineItemDto[];
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
