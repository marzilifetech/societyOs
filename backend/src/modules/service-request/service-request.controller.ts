import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceRequestService } from './service-request.service';
import {
  CreateServiceRequestDto,
  UpdateServiceRequestStatusDto,
  RateServiceRequestDto,
  ServicePhotoUploadQueryDto,
  ConfirmServicePhotoDto,
  AddServiceTaskNoteDto,
  CompleteServiceRequestDto,
  DisputeResponseDto,
  ProofServiceRequestDto,
  RaiseDisputeDto,
  AssignWithScheduleDto,
} from './dto/service-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { ServiceRequestStatus, UserRole } from '@prisma/client';

@ApiTags('service-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('service-requests')
export class ServiceRequestController {
  constructor(private srService: ServiceRequestService) {}

  @Post()
  @Roles(UserRole.RESIDENT)
  create(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CreateServiceRequestDto,
  ) {
    return this.srService.create(user.sub, societyId, dto);
  }

  @Get('my')
  @Roles(UserRole.RESIDENT)
  myRequests(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string) {
    return this.srService.findByResident(user.sub, societyId);
  }

  @Get('assigned')
  @Roles(UserRole.STAFF)
  assignedRequests(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string) {
    return this.srService.findByStaff(user.sub, societyId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  allRequests(
    @SocietyId() societyId: string,
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ServiceRequestStatus,
  ) {
    return this.srService.findBySociety(societyId, status, user.managedBlocks);
  }

  @Get(':id/photo-upload-url')
  @Roles(UserRole.STAFF)
  photoUploadUrl(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Query() q: ServicePhotoUploadQueryDto,
  ) {
    return this.srService.getPhotoUploadUrl(id, user.sub, societyId, q.phase, q.contentType);
  }

  @Get(':id/photos/presign')
  @Roles(UserRole.STAFF)
  photosPresign(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Query() q: ServicePhotoUploadQueryDto,
  ) {
    return this.srService.getPhotoUploadUrl(id, user.sub, societyId, q.phase, q.contentType);
  }

  @Get(':id/voice-upload-url')
  @Roles(UserRole.STAFF)
  voiceUploadUrl(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Query('contentType') contentType?: string,
  ) {
    return this.srService.getVoiceUploadUrl(id, user.sub, societyId, contentType);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return user.role === UserRole.RESIDENT
      ? this.srService.findOne(id, { residentUserId: user.sub, societyId: user.societyId })
      : this.srService.findOne(id, { societyId: user.societyId });
  }

  @Post(':id/photos')
  @Roles(UserRole.STAFF)
  confirmPhoto(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: ConfirmServicePhotoDto,
  ) {
    return this.srService.confirmPhoto(id, user.sub, societyId, dto.key, dto.phase, dto.lat, dto.lng, dto.takenAt);
  }

  @Post(':id/notes')
  @Roles(UserRole.STAFF)
  addNote(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: AddServiceTaskNoteDto,
  ) {
    return this.srService.addTaskNote(id, user.sub, societyId, dto.body, dto.voiceUrl);
  }

  @Post(':id/proof')
  @Roles(UserRole.STAFF)
  proof(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: ProofServiceRequestDto,
  ) {
    return this.srService.proof(id, user.sub, societyId, dto.photoUrl);
  }

  @Patch(':id/complete')
  @Roles(UserRole.STAFF)
  complete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CompleteServiceRequestDto,
  ) {
    return this.srService.completeWork(id, user.sub, societyId, dto.photoUrls, dto.notes);
  }

  @Post(':id/dispute-response')
  @Roles(UserRole.STAFF)
  disputeResponse(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: DisputeResponseDto,
  ) {
    return this.srService.disputeResponse(id, user.sub, societyId, dto.response, dto.photoUrls ?? []);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  updateStatus(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() dto: UpdateServiceRequestStatusDto,
  ) {
    return this.srService.updateStatus(id, societyId, dto);
  }

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  assign(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() dto: AssignWithScheduleDto,
  ) {
    const staffIds = dto.staffIds?.length
      ? dto.staffIds
      : dto.staffId
        ? [dto.staffId]
        : [];
    return this.srService.assignStaffWithSchedule(id, societyId, staffIds, dto.scheduledTime);
  }

  @Post(':id/auto-assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  autoAssign(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() body: { scheduledTime?: string },
  ) {
    return this.srService.autoAssign(id, societyId, body.scheduledTime);
  }

  @Post(':id/confirm')
  @Roles(UserRole.RESIDENT)
  confirm(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    return this.srService.confirmCompletion(id, user.sub, societyId);
  }

  @Post(':id/dispute')
  @Roles(UserRole.RESIDENT)
  dispute(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.srService.raiseDispute(id, user.sub, societyId, dto.reason);
  }

  @Post(':id/rate')
  @Roles(UserRole.RESIDENT)
  rate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: RateServiceRequestDto,
  ) {
    return this.srService.rate(id, user.sub, societyId, dto);
  }
}
