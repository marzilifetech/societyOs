import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ParkingService } from './parking.service';
import {
  RequestGuestParkingDto,
  ReportUnauthorizedDto,
  GuestParkingRequestDto,
  LogGuestParkingDto,
} from './dto/parking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('parking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parking')
export class ParkingController {
  constructor(private parkingService: ParkingService) {}

  @Get('my-slot')
  @Roles(UserRole.RESIDENT)
  getMySlot(@CurrentUser() user: JwtPayload) {
    return this.parkingService.getMySlot(user.sub);
  }

  @Get('my')
  @Roles(UserRole.RESIDENT)
  getMySlots(@CurrentUser() user: JwtPayload) {
    return this.parkingService.getMySlots(user.sub);
  }

  @Get('guest-requests')
  @Roles(UserRole.RESIDENT)
  getGuestRequests(@CurrentUser() user: JwtPayload) {
    return this.parkingService.getGuestRequests(user.sub);
  }

  @Get('guest-history')
  @Roles(UserRole.RESIDENT)
  getGuestHistory(@CurrentUser() user: JwtPayload) {
    return this.parkingService.getGuestRequests(user.sub);
  }

  @Post('guest-request')
  @Roles(UserRole.RESIDENT)
  createGuestRequest(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: GuestParkingRequestDto,
  ) {
    return this.parkingService.createGuestRequest(user.sub, societyId, dto);
  }

  @Get('slots')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAllSlots(@SocietyId() societyId: string) {
    return this.parkingService.getAllSlots(societyId);
  }

  @Get('availability')
  getAvailability(@SocietyId() societyId: string) {
    return this.parkingService.getAvailability(societyId);
  }

  @Post('guest')
  @Roles(UserRole.RESIDENT)
  requestGuestParking(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string, @Body() dto: RequestGuestParkingDto) {
    return this.parkingService.requestGuestParking(user.sub, societyId, dto);
  }

  @Post('report')
  @Roles(UserRole.RESIDENT)
  reportUnauthorized(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string, @Body() dto: ReportUnauthorizedDto) {
    return this.parkingService.reportUnauthorized(user.sub, societyId, dto);
  }

  // ── Admin / gate guest parking ──────────────────────────────────────────
  // POST /parking/guest above is @Roles(RESIDENT) and resolves a Resident
  // profile from the caller, so the dashboard's "Log Guest Parking" button
  // 403'd for every admin. These endpoints are the admin/security equivalent.

  @Post('admin/guest')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  logGuestParking(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: LogGuestParkingDto,
  ) {
    return this.parkingService.logGuestParking(societyId, user.sub, dto);
  }

  @Get('admin/guest')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  listGuestParking(@SocietyId() societyId: string, @Query('active') active?: string) {
    return this.parkingService.listGuestParking(societyId, active === 'true' || active === '1');
  }

  @Patch('admin/guest/:id/exit')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  exitGuestParking(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.parkingService.exitGuestParking(societyId, id);
  }
}
