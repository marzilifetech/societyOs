import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HelpRequestService } from './help-request.service';
import { CreateHelpRequestDto, UpdateHelpRequestStatusDto } from './dto/help-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('help-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('help-requests')
export class HelpRequestController {
  constructor(private helpService: HelpRequestService) {}

  @Get()
  @Roles(UserRole.RESIDENT)
  getResidentHelpRequests(@CurrentUser() user: JwtPayload) {
    return this.helpService.getResidentHelpRequests(user.sub);
  }

  @Post()
  @Roles(UserRole.RESIDENT)
  createHelpRequest(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CreateHelpRequestDto,
  ) {
    return this.helpService.createHelpRequest(user.sub, societyId, dto);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT)
  getHelpRequestById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    return this.helpService.getHelpRequestById(id, user.sub, societyId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.RESIDENT)
  cancelHelpRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    return this.helpService.cancelHelpRequest(id, user.sub, societyId);
  }

  @Post(':id/rate')
  @Roles(UserRole.RESIDENT)
  rateHelpRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.helpService.rateHelpRequest(id, user.sub, societyId, body.rating, body.comment);
  }

  @Get(':id/photo-upload-url')
  @Roles(UserRole.RESIDENT, UserRole.STAFF)
  getPhotoUploadUrl(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Query('contentType') contentType?: string,
  ) {
    return this.helpService.getHelpRequestPhotoUploadUrl(id, societyId, contentType);
  }
}

@ApiTags('help-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff/help-requests')
export class StaffHelpRequestController {
  constructor(private helpService: HelpRequestService) {}

  @Get()
  @Roles(UserRole.STAFF)
  getMyHelpRequests(@CurrentUser() user: JwtPayload) {
    return this.helpService.getMyHelpRequests(user.sub);
  }

  @Get(':id')
  @Roles(UserRole.STAFF)
  getMyHelpRequestById(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.helpService.getMyHelpRequestById(user.sub, id, societyId);
  }

  @Post(':id/accept')
  @Roles(UserRole.STAFF)
  accept(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.helpService.acceptHelpRequest(user.sub, id, societyId);
  }

  @Post(':id/decline')
  @Roles(UserRole.STAFF)
  decline(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.helpService.declineHelpRequest(user.sub, id, societyId);
  }

  @Patch(':id/status')
  @Roles(UserRole.STAFF)
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHelpRequestStatusDto,
  ) {
    return this.helpService.updateHelpRequestStatus(user.sub, id, societyId, dto.status);
  }

  @Post(':id/complete')
  @Roles(UserRole.STAFF)
  complete(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.helpService.completeHelpRequest(user.sub, id, societyId);
  }
}
