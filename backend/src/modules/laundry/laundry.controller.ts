import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LaundryBookingStatus, LaundryType, UserRole } from '@prisma/client';
import { LaundryService } from './laundry.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('laundry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('laundry')
export class LaundryController {
  constructor(private laundryService: LaundryService) {}

  @Get('slots')
  getSlots(@SocietyId() societyId: string, @Query('date') date: string) {
    return this.laundryService.getSlots(societyId, date);
  }

  @Post('bookings')
  @Roles(UserRole.RESIDENT)
  createBooking(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: { scheduledAt: string; type: LaundryType; itemCount: number; notes?: string },
  ) {
    return this.laundryService.createBooking(user.sub, societyId, dto);
  }

  @Get('bookings/my')
  @Roles(UserRole.RESIDENT)
  getMyBookings(@CurrentUser() user: JwtPayload) {
    return this.laundryService.getMyBookings(user.sub);
  }

  @Patch('bookings/:id/cancel')
  @Roles(UserRole.RESIDENT)
  cancelBooking(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.laundryService.cancelBooking(user.sub, id);
  }

  @Get('/admin/laundry/bookings')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAll(@SocietyId() societyId: string, @Query('status') status?: LaundryBookingStatus) {
    return this.laundryService.getAll(societyId, status);
  }

  @Patch('/admin/laundry/bookings/:id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body() body: { status: LaundryBookingStatus }) {
    return this.laundryService.updateStatus(id, body.status);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getBookingById(@Param('id') id: string) {
    return this.laundryService.getBookingById(id);
  }

  @Patch(':id/pickup')
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  markPickedUp(@Param('id') id: string) {
    return this.laundryService.markPickedUp(id);
  }

  @Get(':id/photo-upload-url')
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getPhotoUploadUrl(@Param('id') id: string, @Query('contentType') contentType?: string) {
    return this.laundryService.getPhotoUploadUrl(id, contentType);
  }
}
