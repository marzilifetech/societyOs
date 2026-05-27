import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConciergeService } from './concierge.service';
import { RateConciergeDto } from './dto/concierge.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('concierge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('concierge')
export class ConciergeController {
  constructor(private conciergeService: ConciergeService) {}

  @Post()
  @Roles(UserRole.RESIDENT)
  createRequest(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: { type: string; description?: string },
  ) {
    return this.conciergeService.createRequest(user.sub, societyId, dto);
  }

  @Get('my')
  @Roles(UserRole.RESIDENT)
  getMyRequests(@CurrentUser() user: JwtPayload) {
    return this.conciergeService.getMyRequests(user.sub);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.RESIDENT)
  cancelRequest(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.conciergeService.cancelRequest(user.sub, id, societyId);
  }

  @Get('admin/requests')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAll(@SocietyId() societyId: string, @Query('status') status?: string) {
    return this.conciergeService.getAll(societyId, status);
  }

  @Patch('admin/requests/:id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body('status') status: string,
    @Body('note') note?: string,
  ) {
    return this.conciergeService.updateStatus(id, societyId, status, note);
  }
}

@ApiTags('concierge-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('concierge-requests')
export class ConciergeRequestsController {
  constructor(private conciergeService: ConciergeService) {}

  @Get()
  @Roles(UserRole.RESIDENT)
  getHistory(@CurrentUser() user: JwtPayload) {
    return this.conciergeService.getMyRequests(user.sub);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT)
  getOne(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.conciergeService.getMyRequest(user.sub, id, societyId);
  }

  @Patch(':id/rate')
  @Roles(UserRole.RESIDENT)
  rate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: RateConciergeDto,
  ) {
    return this.conciergeService.rateRequest(user.sub, id, societyId, dto);
  }
}
