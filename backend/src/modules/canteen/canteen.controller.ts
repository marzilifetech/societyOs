import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CanteenService } from './canteen.service';
import { UpdateMenuDto } from './dto/canteen.dto';
import { CreatePreOrderDto, UpdatePreOrderStatusDto } from './dto/pre-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('canteen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('canteen')
export class CanteenController {
  constructor(private canteenService: CanteenService) {}

  @Get('menu')
  getMenu(@SocietyId() societyId: string, @Query('date') date: string) {
    return date
      ? this.canteenService.getMenu(societyId, date)
      : this.canteenService.getWeekMenu(societyId);
  }

  @Get('dishes/:id')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getDish(@Param('id') id: string) {
    return this.canteenService.getDish(id);
  }

  @Post('dishes/:id/rate')
  @Roles(UserRole.RESIDENT)
  rateDish(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: { rating: number; comment?: string; preOrderId?: string },
  ) {
    return this.canteenService.rateDish(id, user.sub, dto);
  }

  @Post('menu')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  upsertMenu(@SocietyId() societyId: string, @Body() dto: UpdateMenuDto) {
    return this.canteenService.upsertMenu(societyId, dto.date, dto.mealType, dto.dishes);
  }

  // ── Pre-Order endpoints ───────────────────────────────────────────────────────

  @Post('pre-orders')
  @Roles(UserRole.RESIDENT)
  createPreOrder(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CreatePreOrderDto,
  ) {
    return this.canteenService.createPreOrder(user.sub, societyId, dto);
  }

  @Get('pre-orders')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listPreOrders(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    return this.canteenService.listPreOrders(user.sub, societyId, user.role, date, status);
  }

  @Get('pre-orders/:id')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getPreOrder(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.canteenService.getPreOrder(id, user.sub, user.role);
  }

  @Patch('pre-orders/:id/cancel')
  @Roles(UserRole.RESIDENT)
  cancelPreOrder(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.canteenService.cancelPreOrder(id, user.sub);
  }

  @Patch('pre-orders/:id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updatePreOrderStatus(@Param('id') id: string, @Body() dto: UpdatePreOrderStatusDto) {
    return this.canteenService.updatePreOrderStatus(id, dto);
  }

  // ── Admin endpoints ──────────────────────────────────────────────────────────

  @Get('/admin/canteen/analytics')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getMenuAnalytics(@SocietyId() societyId: string) {
    return this.canteenService.getMenuAnalytics(societyId);
  }

  @Get('/admin/canteen/ratings')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdminDishRatings(
    @SocietyId() societyId: string,
    @Query('dishId') dishId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.canteenService.listAdminDishRatings(societyId, {
      dishId,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('/admin/canteen/dishes/:id/reviews')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdminDishReviews(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.canteenService.listAdminDishReviews(
      id,
      societyId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Post('/admin/canteen/menus/copy-week')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  copyWeekMenus(
    @SocietyId() societyId: string,
    @Body() dto: { sourceWeekStart: string; targetWeekStart: string },
  ) {
    return this.canteenService.copyWeekMenus(societyId, dto.sourceWeekStart, dto.targetWeekStart);
  }

  @Post('/admin/canteen/menus')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createMenu(@SocietyId() societyId: string, @Body() dto: { date: string; mealType: string; dishes?: any[] }) {
    return this.canteenService.createMenu(societyId, dto);
  }

  @Put('/admin/canteen/menus/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateMenu(@Param('id') id: string, @Body() dto: any) {
    return this.canteenService.updateMenu(id, dto);
  }

  @Delete('/admin/canteen/menus/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deleteMenu(@Param('id') id: string) {
    return this.canteenService.deleteMenu(id);
  }

  @Post('/admin/canteen/menus/:id/dishes')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  addDish(
    @Param('id') menuId: string,
    @Body() dto: { name: string; price: number; calories?: number; allergens?: string[]; isVeg: boolean },
  ) {
    return this.canteenService.addDish(menuId, dto);
  }

  @Patch('/admin/canteen/dishes/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateDish(@Param('id') id: string, @Body() dto: any) {
    return this.canteenService.updateDish(id, dto);
  }

  @Delete('/admin/canteen/dishes/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deleteDish(@Param('id') id: string) {
    return this.canteenService.deleteDish(id);
  }
}
