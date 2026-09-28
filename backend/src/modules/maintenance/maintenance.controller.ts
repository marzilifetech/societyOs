import { Controller, Get, Post, Param, Body, UseGuards, ForbiddenException, Headers, RawBodyRequest, Req, Query, Header, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { onlinePaymentDisabled } from '../../common/utils/online-payment.util';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class WebhookBodyDto {
  @ApiProperty()
  @IsString()
  paymentId: string;

  @ApiProperty()
  @IsString()
  signature: string;
}

class AutoPayDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private maintenanceService: MaintenanceService) {}

  @Get('bills/export')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="bills.csv"')
  async exportBills(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: string,
    @Query('residentId') residentId?: string,
  ): Promise<StreamableFile> {
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    const csv = await this.maintenanceService.exportBillsCsv({
      userId: user.sub,
      isAdmin,
      year: year ? parseInt(year, 10) : undefined,
      residentId,
    });
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Post('auto-pay')
  @Roles(UserRole.RESIDENT)
  setAutoPay(@CurrentUser() user: JwtPayload, @Body() dto: AutoPayDto) {
    return this.maintenanceService.setAutoPay(user.sub, dto.enabled);
  }

  @Get('bills')
  @Roles(UserRole.RESIDENT)
  getBills(@CurrentUser() user: JwtPayload) {
    return this.maintenanceService.getBills(user.sub);
  }

  @Get('bills/:id')
  @Roles(UserRole.RESIDENT)
  getBill(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.maintenanceService.getBill(id, user.sub);
  }

  @Get('payment-status/:id')
  @Roles(UserRole.RESIDENT)
  getPaymentStatus(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.maintenanceService.getPaymentStatus(id, user.sub);
  }

  @Get('receipt/:id')
  @Roles(UserRole.RESIDENT)
  getReceipt(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.maintenanceService.getReceipt(id, user.sub);
  }

  // Resident online payment is switched off — maintenance is paid at the society
  // office. These four routes answer 410; see onlinePaymentDisabled(). No @Body,
  // so an old client's payload cannot turn the 410 into a validation 400.
  @Post('bills/:id/pay')
  @Roles(UserRole.RESIDENT)
  createOrderByParam() {
    onlinePaymentDisabled();
  }

  @Post('payment-order')
  @Roles(UserRole.RESIDENT)
  createOrder() {
    onlinePaymentDisabled();
  }

  @Post('payments/:id/verify')
  @Roles(UserRole.RESIDENT)
  verifyPaymentByParam() {
    onlinePaymentDisabled();
  }

  @Post('verify-payment')
  @Roles(UserRole.RESIDENT)
  verifyPayment() {
    onlinePaymentDisabled();
  }

  /**
   * Razorpay webhook — no auth. P1 must enable raw-body capture for this route.
   * Verifies HMAC-SHA256 of raw body against header `x-razorpay-signature`.
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<any>,
    @Headers('x-razorpay-signature') signature: string,
    @Body() body: any,
  ) {
    const raw: Buffer | undefined = (req as any).rawBody;
    if (raw && signature) {
      return this.maintenanceService.handleRazorpayWebhook(raw, signature);
    }

    // Legacy fallback for old clients posting JSON without raw-body capture.
    if (body?.razorpay_order_id && body?.razorpay_payment_id && body?.razorpay_signature) {
      const fakeRaw = Buffer.from(
        `${body.razorpay_order_id}|${body.razorpay_payment_id}`,
        'utf-8',
      );
      const computedHeader = require('crypto')
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
        .update(fakeRaw)
        .digest('hex');
      if (computedHeader !== body.razorpay_signature) {
        throw new ForbiddenException({ code: 'INVALID_SIGNATURE' });
      }
      return this.maintenanceService.handleWebhookPayment(body.razorpay_payment_id);
    }

    throw new ForbiddenException({ code: 'INVALID_SIGNATURE' });
  }
}
