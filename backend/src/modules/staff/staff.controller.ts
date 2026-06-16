import { Controller, Get, Post, Patch, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  CreateLeaveRequestDto,
  UpdateLeaveStatusDto,
  AttendanceQueryDto,
  CheckInDto,
  CheckOutDto,
  LateReasonDto,
  ShiftRangeDto,
  HolidayQueryDto,
  RejectTaskDto,
  AddTaskNoteDto,
  PresignedUploadQueryDto,
  ConfirmTaskPhotoDto,
  TaskHistoryQueryDto,
  FlagReviewDto,
  EmergencyContactDto,
  DocumentUploadDto,
  LeaderboardQueryDto,
} from './dto/staff.dto';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get('profile')
  @Roles(UserRole.STAFF)
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.staffService.getProfile(user.sub);
  }

  @Get('me')
  @Roles(UserRole.STAFF)
  getProfileAlias(@CurrentUser() user: JwtPayload) {
    return this.staffService.getProfile(user.sub);
  }

  @Get('summary')
  @Roles(UserRole.STAFF)
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.staffService.getSummary(user.sub);
  }

  @Get('society')
  @Roles(UserRole.STAFF)
  getSocietyGeofence(@CurrentUser() user: JwtPayload) {
    return this.staffService.getSocietyGeofence(user.sub);
  }

  @Get('leaves')
  @Roles(UserRole.STAFF)
  getMyLeaves(@CurrentUser() user: JwtPayload) {
    return this.staffService.getMyLeaves(user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  all(@SocietyId() societyId: string) {
    return this.staffService.findBySociety(societyId);
  }

  @Post('check-in')
  @Roles(UserRole.STAFF)
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInDto) {
    return this.staffService.checkIn(user.sub, dto.lat, dto.lng, dto.photoUrl, dto.biometricVerified, dto.deviceId);
  }

  @Post('attendance/check-in')
  @Roles(UserRole.STAFF)
  checkInAlias(@CurrentUser() user: JwtPayload, @Body() dto: CheckInDto) {
    return this.staffService.checkIn(user.sub, dto.lat, dto.lng, dto.photoUrl, dto.biometricVerified, dto.deviceId);
  }

  @Post('check-in/late-reason')
  @Roles(UserRole.STAFF)
  submitLateReason(@CurrentUser() user: JwtPayload, @Body() dto: LateReasonDto) {
    return this.staffService.submitLateReason(user.sub, dto.reason);
  }

  @Post('check-out')
  @Roles(UserRole.STAFF)
  checkOut(@CurrentUser() user: JwtPayload, @Body() dto: CheckOutDto) {
    return this.staffService.checkOut(user.sub, dto.lat, dto.lng);
  }

  @Post('attendance/check-out')
  @Roles(UserRole.STAFF)
  checkOutAlias(@CurrentUser() user: JwtPayload, @Body() dto: CheckOutDto) {
    return this.staffService.checkOut(user.sub, dto.lat, dto.lng);
  }

  @Get('attendance/today')
  @Roles(UserRole.STAFF)
  getTodayAttendance(@CurrentUser() user: JwtPayload) {
    return this.staffService.getTodayAttendance(user.sub);
  }

  @Get('attendance')
  @Roles(UserRole.STAFF)
  getAttendance(@CurrentUser() user: JwtPayload, @Query() query: AttendanceQueryDto) {
    return this.staffService.getAttendance(user.sub, query.month, query.year);
  }

  @Post('leave')
  @Roles(UserRole.STAFF)
  requestLeave(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeaveRequestDto) {
    return this.staffService.requestLeave(user.sub, dto);
  }

  @Patch('leave/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateLeave(@Param('id') id: string, @SocietyId() societyId: string, @Body() dto: UpdateLeaveStatusDto) {
    return this.staffService.updateLeave(id, societyId, dto.status, dto.adminNote);
  }

  // ─── Shifts + holidays ──────────────────────────────────

  @Get('shifts')
  @Roles(UserRole.STAFF)
  getShifts(@CurrentUser() user: JwtPayload, @Query() q: ShiftRangeDto) {
    return this.staffService.getShifts(user.sub, q.range ?? 'today');
  }

  @Get('holidays')
  @Roles(UserRole.STAFF)
  getHolidays(@SocietyId() societyId: string, @Query() q: HolidayQueryDto) {
    return this.staffService.getHolidays(societyId, q.year);
  }

  // ─── Tasks (service-request) extensions ─────────────────

  @Post('tasks/:id/accept')
  @Roles(UserRole.STAFF)
  acceptTask(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.staffService.acceptTask(user.sub, id);
  }

  @Post('tasks/:id/reject')
  @Roles(UserRole.STAFF)
  rejectTask(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RejectTaskDto) {
    return this.staffService.rejectTask(user.sub, id, dto.reason);
  }

  @Post('tasks/:id/notes')
  @Roles(UserRole.STAFF)
  addTaskNote(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AddTaskNoteDto) {
    return this.staffService.addTaskNote(user.sub, id, dto.body, dto.voiceUrl);
  }

  @Get('tasks/:id/upload-url')
  @Roles(UserRole.STAFF)
  getTaskUploadUrl(@Param('id') id: string, @Query() q: PresignedUploadQueryDto) {
    return this.staffService.getPresignedTaskUploadUrl(id, q.phase, q.contentType);
  }

  @Post('tasks/:id/photos')
  @Roles(UserRole.STAFF)
  confirmTaskPhoto(@Param('id') id: string, @Body() dto: ConfirmTaskPhotoDto) {
    return this.staffService.confirmTaskPhoto(id, dto.key, dto.phase, dto.lat, dto.lng, dto.takenAt);
  }

  @Get('tasks/history')
  @Roles(UserRole.STAFF)
  getMyTaskHistory(@CurrentUser() user: JwtPayload, @Query() q: TaskHistoryQueryDto) {
    return this.staffService.getMyTaskHistory(user.sub, q.status, q.page ?? 1, q.pageSize ?? 20);
  }

  // ─── Leaderboard ────────────────────────────────────────

  @Get('leaderboard')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getLeaderboard(@SocietyId() societyId: string, @Query() q: LeaderboardQueryDto) {
    return this.staffService.getLeaderboard(societyId, q.period ?? 'MONTH');
  }

  // ─── Reviews + performance ──────────────────────────────

  @Get('reviews')
  @Roles(UserRole.STAFF)
  getMyReviews(@CurrentUser() user: JwtPayload, @Query('page') page?: string) {
    return this.staffService.getMyReviews(user.sub, page ? parseInt(page, 10) : 1);
  }

  @Get('performance')
  @Roles(UserRole.STAFF)
  getMyPerformance(@CurrentUser() user: JwtPayload) {
    return this.staffService.getMyPerformance(user.sub);
  }

  @Post('reviews/:id/flag')
  @Roles(UserRole.STAFF)
  flagReview(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: FlagReviewDto) {
    return this.staffService.flagReview(user.sub, id, dto.reason);
  }

  // ─── Leave balance ──────────────────────────────────────

  @Get('leave-balance')
  @Roles(UserRole.STAFF)
  getLeaveBalance(@CurrentUser() user: JwtPayload) {
    return this.staffService.getLeaveBalance(user.sub);
  }

  // ─── Documents, salary, emergency contact ───────────────

  @Get('documents')
  @Roles(UserRole.STAFF)
  getMyDocuments(@CurrentUser() user: JwtPayload) {
    return this.staffService.getMyDocuments(user.sub);
  }

  @Post('documents')
  @Roles(UserRole.STAFF)
  getDocumentUploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: DocumentUploadDto) {
    return this.staffService.getDocumentUploadUrl(user.sub, dto);
  }

  @Get('salary')
  @Roles(UserRole.STAFF)
  getSalarySlips(@CurrentUser() user: JwtPayload) {
    return this.staffService.getSalarySlips(user.sub);
  }

  @Get('emergency-contact')
  @Roles(UserRole.STAFF)
  getEmergencyContact(@CurrentUser() user: JwtPayload) {
    return this.staffService.getEmergencyContact(user.sub);
  }

  @Put('emergency-contact')
  @Roles(UserRole.STAFF)
  updateEmergencyContact(@CurrentUser() user: JwtPayload, @Body() dto: EmergencyContactDto) {
    return this.staffService.updateEmergencyContact(user.sub, dto);
  }

  @Get('notices')
  @Roles(UserRole.STAFF)
  getNotices(@CurrentUser() user: JwtPayload) {
    return this.staffService.getNotices(user.sub);
  }

  /** Placeholder until patrol/rounds backend is scoped per society. */
  @Get('rounds')
  @Roles(UserRole.STAFF)
  getPatrolRounds() {
    return {
      items: [] as unknown[],
      message:
        'No patrol rounds configured. When enabled, society admins will publish checkpoints here.',
    };
  }

  // ─── Presigned URL helpers ──────────────────────────────────

  @Get('check-in/voice-upload-url')
  @Roles(UserRole.STAFF)
  getCheckInVoiceUploadUrl(@CurrentUser() user: JwtPayload, @Query('contentType') contentType?: string) {
    return this.staffService.getCheckInVoiceUploadUrl(user.sub, contentType);
  }

  /**
   * Persist a staff profile photo URL.
   *
   * The previous flow (`/profile/photo-url` → S3 presign → `/photo-confirm`)
   * relied on the backend's own S3 IAM credentials which lack PutObject on
   * any bucket, so every PUT failed with 403. Staff photos now flow through
   * the Marzi `/media` proxy (same path as resident-app uploads) — the
   * client uploads to Marzi's S3 directly with Marzi's presigned POST, then
   * tells us the public URL it received. We just persist.
   */
  @Post('profile/photo')
  @Roles(UserRole.STAFF)
  setProfilePhoto(@CurrentUser() user: JwtPayload, @Body() body: { photoUrl: string }) {
    return this.staffService.setProfilePhoto(user.sub, body.photoUrl);
  }

  // ─── Documents confirm ──────────────────────────────────────

  @Post('documents/confirm')
  @Roles(UserRole.STAFF)
  confirmDocumentUpload(
    @CurrentUser() user: JwtPayload,
    @Body() body: { documentId?: string; key: string; type?: string },
  ) {
    return this.staffService.confirmDocumentUpload(user.sub, body);
  }

  // ─── Device tokens (FCM) ────────────────────────────────────

  @Post('devices')
  @Roles(UserRole.STAFF)
  registerDevice(
    @CurrentUser() user: JwtPayload,
    @Body() body: { token: string; platform: 'ios' | 'android' },
  ) {
    return this.staffService.registerDevice(user.sub, body.token, body.platform);
  }

  // ─── Visitor gate (security staff) ─────────────────────────

  @Get('visitors')
  @Roles(UserRole.STAFF)
  getVisitorsForGate(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Query('approvalStatus') approvalStatus?: string,
  ) {
    return this.staffService.getVisitorsForGate(user.sub, societyId, approvalStatus);
  }

  @Patch('visitors/:id/approve')
  @Roles(UserRole.STAFF)
  approveVisitor(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.staffService.approveVisitorAsSecurity(user.sub, societyId, id);
  }

  @Patch('visitors/:id/reject')
  @Roles(UserRole.STAFF)
  rejectVisitor(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.staffService.rejectVisitorAsSecurity(user.sub, societyId, id);
  }
}
