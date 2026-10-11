import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ParseEntityIdPipe } from '../../common/pipes/parse-entity-id.pipe';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HousekeepingService } from './housekeeping.service';
import { CreateHousekeepingDto } from './dto/create-housekeeping.dto';
import { RateHousekeepingDto } from './dto/rate-housekeeping.dto';
import { UpdateHousekeepingStatusDto } from './dto/update-housekeeping-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('housekeeping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('housekeeping')
export class HousekeepingController {
  constructor(private housekeepingService: HousekeepingService) {}

  @Post()
  @Roles(UserRole.RESIDENT)
  create(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CreateHousekeepingDto,
  ) {
    return this.housekeepingService.create(user.sub, societyId, dto);
  }

  @Get()
  getAll(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('scope') scope?: string,
  ) {
    // A resident who is also a society admin has role=ADMIN, so a bare role
    // check sent them the society-wide list inside their own resident app.
    // Residents get their own requests unless the caller asks for the
    // society's (`scope=all`, sent by the admin console).
    const wantsMine = scope !== 'all';
    if (wantsMine && (user.isResident || user.role === UserRole.RESIDENT)) {
      return this.housekeepingService.findForResident(user.sub, +page, +limit);
    }
    if (user.role === UserRole.RESIDENT) {
      return this.housekeepingService.findForResident(user.sub, +page, +limit);
    }
    if (user.role === UserRole.STAFF) {
      // Staff see their own assignments, not every request in the society.
      return this.housekeepingService.findForStaff(user.sub, societyId, status, +page, +limit);
    }
    return this.housekeepingService.findForAdmin(societyId, status, date, +page, +limit);
  }

  /**
   * The request's own resident, the staff member assigned to it, or an admin.
   * It was resident-only, so the staff completion screen got a 403 and spun.
   */
  @Get(':id')
  @Roles(UserRole.RESIDENT, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findOne(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    if (user.role === UserRole.STAFF) return this.housekeepingService.findOneAsStaff(id, user.sub, societyId);
    if (user.role === UserRole.RESIDENT) return this.housekeepingService.findOne(id, user.sub);
    return this.housekeepingService.findOneAsAdmin(id, societyId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.RESIDENT)
  cancel(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.housekeepingService.cancel(id, user.sub);
  }

  @Patch(':id/rate')
  @Roles(UserRole.RESIDENT)
  rate(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RateHousekeepingDto,
  ) {
    return this.housekeepingService.rate(id, user.sub, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  updateStatus(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: UpdateHousekeepingStatusDto,
  ) {
    return this.housekeepingService.updateStatus(id, societyId, dto, {
      userId: user.sub,
      role: String(user.role),
    });
  }

  @Get(':id/photo-upload-url')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  getPhotoUploadUrl(
    @Param('id', ParseEntityIdPipe) id: string,
    @SocietyId() societyId: string,
    @Query('phase') phase?: string,
    @Query('contentType') contentType?: string,
  ) {
    return this.housekeepingService.getPhotoUploadUrl(id, societyId, phase, contentType);
  }
}
