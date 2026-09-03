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
  ) {
    if (user.role === UserRole.RESIDENT) {
      return this.housekeepingService.findForResident(user.sub, +page, +limit);
    }
    return this.housekeepingService.findForAdmin(societyId, status, date, +page, +limit);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT)
  findOne(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.housekeepingService.findOne(id, user.sub);
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
    @SocietyId() societyId: string,
    @Body() dto: UpdateHousekeepingStatusDto,
  ) {
    return this.housekeepingService.updateStatus(id, societyId, dto);
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
