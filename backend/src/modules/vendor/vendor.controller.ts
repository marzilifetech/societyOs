import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ParseEntityIdPipe } from '../../common/pipes/parse-entity-id.pipe';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VendorService } from './vendor.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/create-vendor.dto';
import { CreateVendorOrderDto, UpdateVendorOrderStatusDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('vendors')
export class VendorController {
  constructor(private vendorService: VendorService) {}

  // ── Vendor ────────────────────────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listVendors(
    @SocietyId() societyId: string,
    @Query('category') category?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.vendorService.listVendors(societyId, category, +page, +limit);
  }

  @Get('orders/mine')
  @Roles(UserRole.RESIDENT)
  myOrders(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.vendorService.myOrders(user.sub, +page, +limit);
  }

  @Get('orders')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  allOrders(
    @SocietyId() societyId: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.vendorService.allOrders(societyId, status, vendorId, +page, +limit);
  }

  @Patch('orders/:id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateOrderStatus(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpdateVendorOrderStatusDto) {
    return this.vendorService.updateOrderStatus(id, dto);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getVendor(@Param('id', ParseEntityIdPipe) id: string) {
    return this.vendorService.getVendor(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createVendor(@SocietyId() societyId: string, @Body() dto: CreateVendorDto) {
    return this.vendorService.createVendor(societyId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateVendor(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorService.updateVendor(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deleteVendor(@Param('id', ParseEntityIdPipe) id: string) {
    return this.vendorService.softDeleteVendor(id);
  }

  // ── Orders ────────────────────────────────────────────────────────────────────

  @Post(':id/orders')
  @Roles(UserRole.RESIDENT)
  placeOrder(
    @Param('id', ParseEntityIdPipe) vendorId: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CreateVendorOrderDto,
  ) {
    return this.vendorService.placeOrder(vendorId, user.sub, societyId, dto);
  }
}
