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
  resolveLeaveFields,
  UpdateLeaveStatusDto,
  AttendanceQueryDto,
  CheckInDto,
  CheckOutDto,
  LateReasonDto,
  ShiftRangeDto,
  HolidayQueryDto,
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
    // The staff app sends leaveType/fromDate/toDate; resolveLeaveFields folds
    // those aliases onto the canonical names.
    return this.staffService.requestLeave(user.sub, resolveLeaveFields(dto));
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
  getSalarySlips(@CurrentUser() user: JwtPayload, @Query('year') year?: string) {
    // `?year=` was sent by the app and silently ignored.
    const y = year ? parseInt(year, 10) : NaN;
    return this.staffService.getSalarySlips(user.sub, y >= 2000 && y <= 2100 ? y : undefined);
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

  // ─── Lookups used by the Add Entry form ────────────────────
  // All return the bare minimum needed by the form — guard against accidental
  // PII leaks (we don't surface phone, email, document urls, etc.).

  /** Every flat in the staff's society + its primary resident name. */
  @Get('flats')
  @Roles(UserRole.STAFF)
  listFlatsForGate(@SocietyId() societyId: string) {
    return this.staffService.listFlatsForGate(societyId);
  }

  /** Look up a resident by phone for the fallback "I only know their phone" path. */
  @Get('residents/lookup')
  @Roles(UserRole.STAFF)
  lookupResidentByPhone(
    @SocietyId() societyId: string,
    @Query('phone') phone: string,
  ) {
    return this.staffService.lookupResidentByPhone(societyId, phone);
  }

  /** Look up the last known visitor by phone (prefills name in the Add Entry form). */
  @Get('visitors/lookup')
  @Roles(UserRole.STAFF)
  lookupVisitorByPhone(
    @SocietyId() societyId: string,
    @Query('phone') phone: string,
  ) {
    return this.staffService.lookupVisitorByPhone(societyId, phone);
  }

  /**
   * Get one visitor row — staff-scoped (only checks society membership, NOT
   * resident ownership). Used by the Add Entry awaiting screen which polls
   * for the resident's decision; the regular /visitors/:id endpoint requires
   * the caller to be the owning resident and would 403 a guard.
   */
  @Get('visitors/:id')
  @Roles(UserRole.STAFF)
  getVisitorById(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.staffService.getVisitorById(societyId, id);
  }
}
