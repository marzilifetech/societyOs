import { BadRequestException, Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { UserRole } from '@prisma/client';
import { IsNumber, IsOptional, IsString, IsPositive, IsNotEmpty, IsInt, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class TopUpOrderDto {
  @ApiProperty({ description: 'Amount in rupees' })
  @IsNumber()
  @IsPositive()
  amount: number;
}

class TopUpVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpaySignature: string;
}

class TransactionPageDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

/**
 * Admin-issued wallet refund.
 *
 * The dashboard's Issue Refund form sends `reason` (its textarea label) and
 * treats `reference` as optional. This DTO demanded `description` and a
 * non-empty `reference`, and the global ValidationPipe runs with
 * `forbidNonWhitelisted: true` — so every submission was rejected with
 * `400 property reason should not exist`. Accept both names, and mint a
 * reference when the admin has no external one, which is the normal case for a
 * goodwill credit.
 */
class RefundDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  residentId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Reason for the refund. Alias of `reason`.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Reason for the refund. Alias of `description`.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'External reference. Auto-generated when omitted.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance')
  @Roles(UserRole.RESIDENT)
  getBalance(@CurrentUser() user: JwtPayload) {
    return this.walletService.getBalanceWithRecentTransactions(user.sub);
  }

  @Get('transactions')
  @Roles(UserRole.RESIDENT)
  getTransactions(@CurrentUser() user: JwtPayload, @Query() query: TransactionPageDto) {
    return this.walletService.getTransactionsPaginated(user.sub, query.page ?? 1, query.limit ?? 20);
  }

  @Post('topup')
  @Roles(UserRole.RESIDENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createTopupOrder(@CurrentUser() user: JwtPayload, @Body() dto: TopUpOrderDto) {
    return this.walletService.createTopupOrder(user.sub, dto.amount);
  }

  @Post('topup/verify')
  @Roles(UserRole.RESIDENT)
  verifyTopup(@CurrentUser() user: JwtPayload, @Body() dto: TopUpVerifyDto) {
    return this.walletService.verifyTopupAndCredit(user.sub, dto);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(private walletService: WalletService) {}

  @Get('activity')
  getActivity(@SocietyId() societyId: string) {
    return this.walletService.getSocietyWalletActivity(societyId);
  }

  @Post('refund')
  refund(
    @Body() dto: RefundDto,
    @SocietyId() societyId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const description = (dto.description ?? dto.reason ?? '').trim();
    if (!description) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'A reason for the refund is required',
      });
    }
    return this.walletService.refund(dto.residentId, {
      amount: dto.amount,
      description,
      // Idempotency key. Without a caller-supplied external reference we mint
      // one; a blank/shared reference would make the service's "already
      // processed" check collapse every refund into the first one.
      reference: dto.reference?.trim() || `manual-refund:${randomUUID()}`,
      societyId,
      issuedBy: user.sub,
    });
  }

  /** Resident lookup for the refund form, so admins stop typing raw ids. */
  @Get('residents')
  searchResidents(@SocietyId() societyId: string, @Query('q') q?: string) {
    return this.walletService.searchResidentsForRefund(societyId, q);
  }
}
