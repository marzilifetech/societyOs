import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConciergeRequestType } from '@prisma/client';

export class RateConciergeDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  review?: string;
}

/**
 * Create a concierge / "Request Help" ticket.
 *
 * `ConciergeRequest.type` is a Prisma enum (TAXI | COURIER | PHARMACY |
 * FORM_HELP | OTHER) but the controller took an untyped `{ type: string }`, so
 * nothing validated it. The resident app's Request Help screen sends its human
 * labels ("Package Pickup", "Heavy Lifting", ...), which reached Prisma as-is
 * and blew up with `Invalid value for argument 'type'` — every single request
 * 500'd, which is the "Request help feature is not functional" report.
 *
 * `type` is accepted as free text here and mapped by `normaliseConciergeType`,
 * so already-shipped app builds start working without an app-store release.
 */
export class CreateConciergeRequestDto {
  @ApiProperty({ description: 'Request category. Human labels are mapped to the enum.' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Free-text preferred slot, e.g. "Today evening"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredTime?: string;
}

/**
 * Maps whatever a client sends into `ConciergeRequestType`.
 *
 * Unrecognised categories fall back to OTHER and the original label is kept in
 * the description — losing the ticket entirely is far worse than losing its
 * precise category.
 */
const CONCIERGE_TYPE_ALIASES: Record<string, ConciergeRequestType> = {
  TAXI: ConciergeRequestType.TAXI,
  CAB: ConciergeRequestType.TAXI,
  CAB_BOOKING: ConciergeRequestType.TAXI,
  COURIER: ConciergeRequestType.COURIER,
  PARCEL: ConciergeRequestType.COURIER,
  PARCEL_COLLECTION: ConciergeRequestType.COURIER,
  PACKAGE_PICKUP: ConciergeRequestType.COURIER,
  PHARMACY: ConciergeRequestType.PHARMACY,
  MEDICINE: ConciergeRequestType.PHARMACY,
  MEDICINE_PICKUP: ConciergeRequestType.PHARMACY,
  GROCERY: ConciergeRequestType.OTHER,
  FORM_HELP: ConciergeRequestType.FORM_HELP,
  DOCUMENT_COLLECT: ConciergeRequestType.FORM_HELP,
  DOCUMENT_HELP: ConciergeRequestType.FORM_HELP,
  PAPERWORK: ConciergeRequestType.FORM_HELP,
  HEAVY_LIFTING: ConciergeRequestType.OTHER,
  OTHER: ConciergeRequestType.OTHER,
};

export function normaliseConciergeType(value: unknown): ConciergeRequestType {
  if (typeof value !== 'string') return ConciergeRequestType.OTHER;
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return CONCIERGE_TYPE_ALIASES[key] ?? ConciergeRequestType.OTHER;
}
