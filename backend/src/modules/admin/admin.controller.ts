import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Header, StreamableFile, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ServiceRequestService } from '../service-request/service-request.service';
import {
  AdminCreateServiceRequestDto,
  AdminUpdateServiceRequestDto,
  UpdateServiceRequestTagsDto,
} from '../service-request/dto/service-request.dto';
import {
  AddSosRecipientDto,
  CreateSocietyDto,
  CreateStaffDto,
  SendPushNotificationDto,
  UpdateSocietyDto,
} from './dto/admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private srService: ServiceRequestService,
  ) {}

  @Get('dashboard/stats')
  getDashboardStats(@SocietyId() societyId: string) {
    return this.adminService.getDashboardStats(societyId);
  }

  @Get('dashboard/financial')
  getFinancialSnapshot(@SocietyId() societyId: string) {
    return this.adminService.getFinancialSnapshot(societyId);
  }

  @Get('activity')
  getActivityFeed(@SocietyId() societyId: string) {
    return this.adminService.getActivityFeed(societyId);
  }

  @Get('society')
  getSociety(@SocietyId() societyId: string) {
    return this.adminService.getSociety(societyId);
  }

  @Patch('society')
  updateSociety(@SocietyId() societyId: string, @Body() dto: UpdateSocietyDto) {
    return this.adminService.updateSociety(societyId, dto);
  }

  @Get('dashboard/complaints-by-category')
  getComplaintsByCategory(@SocietyId() societyId: string) {
    return this.adminService.getComplaintsByCategory(societyId);
  }

  @Get('dashboard/sr-trend')
  getServiceRequestTrend(
    @SocietyId() societyId: string,
    @Query('days') days?: string,
  ) {
    return this.adminService.getServiceRequestTrend(
      societyId,
      days ? parseInt(days, 10) : undefined,
    );
  }

  // F6: birthdays widget for the dashboard. `?on=today` is the only mode
  // wired today; the param exists so we can extend to ?on=YYYY-MM-DD later
  // without breaking the contract.
  @Get('dashboard/birthdays')
  getBirthdays(
    @SocietyId() societyId: string,
    @Query('on') on?: string,
  ) {
    return this.adminService.getBirthdays(societyId, on ?? 'today');
  }

  @Get('residents/pending')
  getPendingResidents(@SocietyId() societyId: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.getPendingResidents(societyId, user.managedBlocks);
  }

  @Get('residents')
  getResidents(@SocietyId() societyId: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.getResidents(societyId, user.managedBlocks);
  }

  @Patch('residents/:id/approve')
  approveResident(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.approveResident(societyId, id);
  }

  @Patch('residents/:id/reject')
  rejectResident(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.rejectResident(societyId, id, reason || 'No reason provided');
  }

  @Post('residents/:id/data-export')
  exportResidentData(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: { reason?: string },
    @Req() req: Request,
  ) {
    return this.adminService.exportResidentDataAsAdmin(
      societyId,
      id,
      { id: user.sub, role: user.role },
      dto?.reason,
      req.ip,
    );
  }

  @Get('staff')
  getStaff(@SocietyId() societyId: string) {
    return this.adminService.getStaff(societyId);
  }

  @Get('leaves')
  getLeaves(@SocietyId() societyId: string, @Query('status') status?: string) {
    return this.adminService.getLeaves(societyId, status);
  }

@Patch('leaves/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  approveLeave(@Param('id') id: string, @SocietyId() societyId: string, @Body('adminNote') adminNote?: string) {
    return this.adminService.approveLeave(id, societyId, adminNote);
  }

  @Post('staff')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createStaff(@SocietyId() societyId: string, @Body() dto: CreateStaffDto) {
    return this.adminService.createStaff(societyId, dto);
  }

  @Get('staff/import/template')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="staff-import-template.csv"')
  staffImportTemplate(): StreamableFile {
    const csv = this.adminService.staffImportTemplate();
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Post('staff/import/preview')
  previewStaffImport(
    @SocietyId() societyId: string,
    @Body('csv') csv: string,
  ) {
    return this.adminService.previewStaffCsv(societyId, csv);
  }

  @Post('staff/import')
  importStaff(
    @SocietyId() societyId: string,
    @Body('csv') csv: string,
  ) {
    return this.adminService.importStaffCsv(societyId, csv, false);
  }

  // C3: cross-tenant transfer is a SUPER_ADMIN action. Regular ADMINs can
  // never reach into another society's staff roster.
  @Patch('staff/:id/transfer')
  @Roles(UserRole.SUPER_ADMIN)
  transferStaff(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: { toSocietyId: string; reason?: string },
  ) {
    return this.adminService.transferStaff(
      id,
      societyId,
      dto.toSocietyId,
      { id: user.sub, role: user.role },
      dto.reason,
    );
  }

  @Patch('staff/:id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deactivateStaff(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.adminService.deactivateStaff(id, societyId);
  }

  @Get('staff/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffDetail(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.adminService.getStaffDetail(id, societyId);
  }

  @Get('staff/:id/attendance')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffAttendance(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Query('month') month?: string,
  ) {
    return this.adminService.getStaffAttendance(societyId, id, month);
  }

  @Get('staff/:id/attendance/export')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  async exportStaffAttendance(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Query('month') month?: string,
  ): Promise<StreamableFile> {
    const csv = await this.adminService.exportStaffAttendanceCsv(societyId, id, month);
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('staff/:id/attendance/summary')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffAttendanceSummary(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Query('month') month?: string,
  ) {
    return this.adminService.getStaffAttendanceSummary(societyId, id, month);
  }

  @Patch('staff/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStaff(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() body: {
      salaryStructure?: Record<string, any>;
      department?: string;
      designation?: string;
      leavingDate?: string | null;
      familyDetails?: any;
      gender?: string;
      dateOfBirth?: string | null;
      emergencyContact?: { name: string; phone: string; relation?: string } | null;
    },
  ) {
    return this.adminService.updateStaff(societyId, id, body);
  }

  @Get('staff/:id/documents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffDocuments(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.getStaffDocuments(societyId, id);
  }

  @Post('staff/:id/documents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  addStaffDocument(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() body: { documentType: string; fileUrl: string },
  ) {
    return this.adminService.addStaffDocument(societyId, id, body.documentType, body.fileUrl, 'admin');
  }

  @Delete('staff/:id/documents/:docId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deleteStaffDocument(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.adminService.deleteStaffDocument(societyId, id, docId);
  }

  @Patch('staff/:id/documents/:docId/verify')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  verifyStaffDocument(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.verifyStaffDocument(societyId, id, docId, user.sub);
  }

  // Alias for `verify` — added 2026-05 because Brave and many ad-blockers
  // ship EasyList/EasyPrivacy filter rules that match URLs containing
  // "verify" (collateral damage from analytics endpoints with names like
  // /verify.gif, /verify?event=). Browsers block the request before it
  // leaves the page, surfacing as a misleading "CORS error" in DevTools.
  // The /review path is identical in behaviour and unaffected by those
  // filter lists. Admin-web should call /review; /verify is retained until
  // the next breaking-change window.
  @Patch('staff/:id/documents/:docId/review')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  reviewStaffDocument(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.verifyStaffDocument(societyId, id, docId, user.sub);
  }

  @Patch('staff/:id/dismiss')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  dismissStaff(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.dismissStaff(societyId, id);
  }

  @Get('staff/:id/salary-slips')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffSalarySlips(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.getStaffSalarySlips(societyId, id);
  }

  @Get('staff/:id/loans')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffLoans(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.getStaffLoans(societyId, id);
  }

  @Post('staff/:id/loans')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createStaffLoan(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() body: { amount: number; reason?: string; status?: string },
  ) {
    return this.adminService.createStaffLoan(societyId, id, body.amount, body.reason, body.status);
  }

  @Get('residents/:id/documents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getResidentDocuments(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.getResidentDocuments(societyId, id);
  }

  // Alias for the legacy `verify` path — see reviewStaffDocument comment for
  // the ad-blocker rationale. Both routes are wired to the same service
  // method; admin-web targets /review going forward.
  @Patch('residents/:id/documents/review')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  reviewResidentDocuments(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() body: { status: 'VERIFIED' | 'REJECTED'; note?: string },
  ) {
    return this.adminService.verifyResidentDocuments(societyId, id, body.status, body.note);
  }

  @Patch('residents/:id/documents/verify')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  verifyResidentDocuments(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() body: { status: 'VERIFIED' | 'REJECTED'; note?: string },
  ) {
    return this.adminService.verifyResidentDocuments(societyId, id, body.status, body.note);
  }

  @Patch('leaves/:id/reject')
  rejectLeave(@Param('id') id: string, @SocietyId() societyId: string, @Body('adminNote') adminNote?: string) {
    return this.adminService.rejectLeave(id, societyId, adminNote);
  }

  @Get('visitors')
  getVisitors(
    @SocietyId() societyId: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.adminService.getVisitors(societyId, status, date);
  }

  @Patch('visitors/:id/approve')
  approveVisitor(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.approveVisitor(id, societyId, user.sub);
  }

  @Patch('visitors/:id/reject')
  rejectVisitor(
    @Param('id') id: string,
    @SocietyId() societyId: string,
  ) {
    return this.adminService.rejectVisitor(id, societyId);
  }

  @Get('complaints')
  getComplaints(@SocietyId() societyId: string, @Query('status') status?: string) {
    return this.adminService.getComplaints(societyId, status);
  }

  @Patch('complaints/:id/status')
  updateComplaintStatus(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('adminNote') adminNote?: string,
  ) {
    return this.adminService.updateComplaintStatus(id, societyId, status, adminNote);
  }

  @Patch('complaints/:id/assign')
  assignComplaint(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body('staffId') staffId: string,
    @Body('staffName') staffName: string,
  ) {
    return this.adminService.assignComplaint(id, societyId, staffId, staffName);
  }

  @Get('maintenance/bills')
  getMaintenanceBills(
    @SocietyId() societyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.adminService.getMaintenanceBills(
      societyId,
      year ? parseInt(year) : undefined,
      month ? parseInt(month) : undefined,
    );
  }

  @Get('maintenance/reports')
  getMaintenanceReport(
    @SocietyId() societyId: string,
    @Query('year') year?: string,
  ) {
    return this.adminService.getMaintenanceReport(societyId, year ? parseInt(year, 10) : undefined);
  }

  @Get('maintenance/reports/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="financial-report.csv"')
  async exportMaintenanceReport(
    @SocietyId() societyId: string,
    @Query('year') year?: string,
    @Query('status') status?: string,
  ): Promise<StreamableFile> {
    const csv = await this.adminService.exportMaintenanceReportCsv(
      societyId,
      year ? parseInt(year, 10) : undefined,
      status,
    );
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Post('maintenance/bills/:id/remind')
  sendPaymentReminder(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.adminService.sendPaymentReminder(id, societyId);
  }

  @Patch('maintenance/bills/:id/mark-failed')
  markBillFailed(@Param('id') id: string) {
    return this.adminService.markBillFailed(id);
  }

  @Post('maintenance/bills/generate')
  generateBills(
    @SocietyId() societyId: string,
    @Body('year') year: number,
    @Body('month') month: number,
  ) {
    return this.adminService.generateBills(societyId, year, month);
  }

  @Get('events')
  getAdminEvents(@SocietyId() societyId: string) {
    return this.adminService.getAdminEvents(societyId);
  }

  @Post('events')
  createEvent(@SocietyId() societyId: string, @Body() dto: any) {
    return this.adminService.createEvent(societyId, dto);
  }

  @Patch('events/:id/cancel')
  cancelEventAdmin(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.cancelEventAdmin(societyId, id);
  }

  @Patch('events/:id')
  updateEventAdmin(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.adminService.updateEventAdmin(societyId, id, dto);
  }

  @Delete('events/:id')
  deleteEventAdmin(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.deleteEventAdmin(societyId, id);
  }

  @Get('events/:id/attendees')
  getEventAttendees(@Param('id') id: string) {
    return this.adminService.getEventAttendees(id);
  }

  @Post('events/:id/notify')
  notifyEventRegistrants(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body('message') message: string,
  ) {
    return this.adminService.notifyEventRegistrants(societyId, id, message);
  }

  @Get('events/:id/feedback')
  getEventFeedback(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.getEventFeedback(societyId, id);
  }

  @Post('holidays')
  createHoliday(
    @SocietyId() societyId: string,
    @Body() dto: { date: string; name: string; isOptional?: boolean },
  ) {
    return this.adminService.createHoliday(societyId, dto);
  }

  @Get('holidays')
  getHolidays(@SocietyId() societyId: string, @Query('year') year?: string) {
    return this.adminService.getHolidays(societyId, year ? parseInt(year, 10) : undefined);
  }

  // ─── M6: Push Notifications ────────────────────────────────────────────────

  @Post('notifications/push')
  sendPushNotification(
    @SocietyId() societyId: string,
    @Body() dto: SendPushNotificationDto,
  ) {
    return this.adminService.sendPushNotification(societyId, dto);
  }

  // ─── M12: SOS Recipients ──────────────────────────────────────────────────

  @Get('sos/recipients')
  getSosRecipients(@SocietyId() societyId: string) {
    return this.adminService.getSosRecipients(societyId);
  }

  @Post('sos/recipients')
  addSosRecipient(@SocietyId() societyId: string, @Body() dto: AddSosRecipientDto) {
    return this.adminService.addSosRecipient(societyId, dto);
  }

  @Delete('sos/recipients/:id')
  removeSosRecipient(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.removeSosRecipient(societyId, id);
  }

  // ─── M13: Residents Export + Bulk Message ─────────────────────────────────

  @Get('residents/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="residents.csv"')
  async exportResidents(@SocietyId() societyId: string): Promise<StreamableFile> {
    const csv = await this.adminService.exportResidentsCsv(societyId);
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Post('residents/bulk-message')
  bulkMessageResidents(
    @SocietyId() societyId: string,
    @Body() dto: { residentIds: string[]; message: string; channel: 'PUSH' | 'SMS' },
  ) {
    return this.adminService.bulkMessageResidents(societyId, dto);
  }

  @Post('residents')
  createResident(
    @SocietyId() societyId: string,
    @Body() dto: { name: string; email?: string; phone: string; flatId: string; type: 'OWNER' | 'TENANT' },
  ) {
    return this.adminService.createResident(societyId, dto);
  }

  @Post('residents/import')
  importResidents(
    @SocietyId() societyId: string,
    @Body('csv') csv: string,
  ) {
    return this.adminService.importResidentsCsv(societyId, csv);
  }


  @Post('residents/import/preview')
  previewResidentsImport(
    @SocietyId() societyId: string,
    @Body('csv') csv: string,
  ) {
    return this.adminService.previewResidentsCsv(societyId, csv);
  }

  @Get('residents/import/template')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="residents-import-template.csv"')
  residentsImportTemplate(): StreamableFile {
    const csv = this.adminService.residentsImportTemplate();
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }


  @Get('residents/:id')
  getResidentDetail(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.getResidentDetail(societyId, id);
  }

  @Patch('residents/:id/dismiss')
  dismissResident(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.dismissResident(id, societyId);
  }

  @Patch('residents/:id')
  updateResident(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() body: {
      dateOfBirth?: string | null;
      roleNote?: string | null;
      emergencyContact?: { name?: string; phone?: string } | null;
    },
  ) {
    return this.adminService.updateResident(id, societyId, body);
  }

  @Delete('residents/:id')
  deleteResident(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.deleteResident(id, societyId, user.role);
  }

  @Patch('maintenance/bills/:id/status')
  updateBillStatus(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('status') status: string,
    @Body('paymentMethod') paymentMethod?: string,
  ) {
    return this.adminService.updateBillStatus(
      id,
      societyId,
      status,
      { id: user.sub, role: user.role },
      paymentMethod,
    );
  }

  // ── Building Admins ──────────────────────────────────────────────────────────

  // ── Society CRUD (SUPER_ADMIN) ───────────────────────────────────────────────

  @Get('societies')
  @Roles(UserRole.SUPER_ADMIN)
  listSocieties(
    @Query('search') search?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('status') status?: string,
  ) {
    const allowed = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
    const statusFilter = allowed.includes(status as any)
      ? (status as 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED')
      : undefined;
    return this.adminService.listAllSocieties({
      search,
      includeArchived: includeArchived === 'true',
      status: statusFilter,
    });
  }

  @Get('platform/stats')
  @Roles(UserRole.SUPER_ADMIN)
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Post('societies')
  @Roles(UserRole.SUPER_ADMIN)
  createSociety(@Body() dto: CreateSocietyDto) {
    return this.adminService.createSociety(dto);
  }

  @Get('societies/:id')
  @Roles(UserRole.SUPER_ADMIN)
  getSocietyDetail(@Param('id') id: string) {
    return this.adminService.getSocietyDetail(id);
  }

  @Patch('societies/:id')
  @Roles(UserRole.SUPER_ADMIN)
  updateSocietyAdmin(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      address?: string;
      city?: string;
      pincode?: string;
      showInDirectory?: boolean;
      contactEmail?: string | null;
      contactPhone?: string | null;
      config?: Record<string, unknown>;
    },
  ) {
    return this.adminService.updateSocietyAdmin(id, dto);
  }

  @Delete('societies/:id')
  @Roles(UserRole.SUPER_ADMIN)
  archiveSociety(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.archiveSociety(id, user.sub);
  }

  @Patch('societies/:id/restore')
  @Roles(UserRole.SUPER_ADMIN)
  restoreSociety(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.restoreSociety(id, user.sub);
  }

  @Patch('societies/:id/suspend')
  @Roles(UserRole.SUPER_ADMIN)
  suspendSociety(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.suspendSociety(id, user.sub, body?.reason);
  }

  @Patch('societies/:id/resume')
  @Roles(UserRole.SUPER_ADMIN)
  resumeSociety(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.resumeSociety(id, user.sub);
  }

  // ── Flats / structure ────────────────────────────────────────────────────────

  @Get('flats')
  listFlats(
    @SocietyId() societyId: string,
    @Query('block') block?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listFlats(societyId, { block, search });
  }

  @Get('blocks')
  listBlocks(@SocietyId() societyId: string) {
    return this.adminService.listBlocks(societyId);
  }

  @Get('flats/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="flats.csv"')
  async exportFlats(@SocietyId() societyId: string): Promise<StreamableFile> {
    const csv = await this.adminService.exportFlatsCsv(societyId);
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('flats/import/template')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="flats-import-template.csv"')
  flatsImportTemplate(): StreamableFile {
    const csv = this.adminService.flatsImportTemplate();
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Post('flats/import/preview')
  previewFlatsImport(
    @SocietyId() societyId: string,
    @Body('csv') csv: string,
  ) {
    return this.adminService.previewFlatsCsv(societyId, csv);
  }

  @Post('flats/import')
  importFlats(
    @SocietyId() societyId: string,
    @Body('csv') csv: string,
  ) {
    return this.adminService.importFlatsCsv(societyId, csv, false);
  }

  @Get('flats/:id')
  getFlat(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.getFlat(societyId, id);
  }

  @Post('flats')
  createFlat(
    @SocietyId() societyId: string,
    @Body() dto: { block: string; floor: number; number: string; areaSqft?: number },
  ) {
    return this.adminService.createFlat(societyId, dto);
  }

  @Patch('flats/:id')
  updateFlat(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() dto: { block?: string; floor?: number; number?: string; areaSqft?: number | null },
  ) {
    return this.adminService.updateFlat(societyId, id, dto);
  }

  @Delete('flats/:id')
  deleteFlat(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.adminService.deleteFlat(societyId, id);
  }

  @Get('building-admins')
  @Roles(UserRole.SUPER_ADMIN)
  listBuildingAdmins(@SocietyId() societyId: string) {
    return this.adminService.listBuildingAdmins(societyId);
  }

  @Post('building-admins')
  @Roles(UserRole.SUPER_ADMIN)
  createBuildingAdmin(
    @SocietyId() societyId: string,
    @Body() dto: { name: string; phone: string },
  ) {
    return this.adminService.createBuildingAdmin(societyId, dto);
  }

  @Patch('building-admins/:id/blocks')
  @Roles(UserRole.SUPER_ADMIN)
  updateManagedBlocks(
    @Param('id') id: string,
    @Body() dto: { managedBlocks: string[] },
  ) {
    return this.adminService.updateManagedBlocks(id, dto.managedBlocks);
  }

  @Delete('building-admins/:id')
  @Roles(UserRole.SUPER_ADMIN)
  removeBuildingAdmin(@Param('id') id: string) {
    return this.adminService.removeBuildingAdmin(id);
  }

  // ─── Service Requests (admin) ─────────────────────────────────────────────

  @Post('service-requests')
  adminCreateServiceRequest(
    @SocietyId() societyId: string,
    @Body() dto: AdminCreateServiceRequestDto,
  ) {
    return this.srService.adminCreate(societyId, dto);
  }

  @Patch('service-requests/:id')
  adminUpdateServiceRequest(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() dto: AdminUpdateServiceRequestDto | UpdateServiceRequestTagsDto,
  ) {
    if ('tags' in dto && Object.keys(dto).length === 1 && dto.tags) {
      return this.srService.updateTags(id, societyId, dto.tags);
    }
    return this.srService.adminUpdate(id, societyId, dto as AdminUpdateServiceRequestDto);
  }

  @Delete('service-requests/:id')
  adminDeleteServiceRequest(
    @Param('id') id: string,
    @SocietyId() societyId: string,
  ) {
    return this.srService.softDelete(id, societyId);
  }

  // ─── Domestic Help (society-wide) ────────────────────────────────────────

  @Get('domestic-help')
  getDomesticHelpers(@SocietyId() societyId: string) {
    return this.adminService.getDomesticHelpers(societyId);
  }

  // ─── Pest Control (society-wide) ─────────────────────────────────────────

  @Get('pest-control')
  getPestControlJobs(@SocietyId() societyId: string) {
    return this.adminService.getPestControlJobs(societyId);
  }

  // ─── Infrastructure (CRUD + bulk import) ─────────────────────────────────

  @Post('infrastructure')
  createInfrastructureItem(
    @SocietyId() societyId: string,
    @Body() dto: { name: string; type: string; status?: string },
  ) {
    return this.adminService.createInfrastructureItem(societyId, dto);
  }

  @Get('infrastructure/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="infrastructure.csv"')
  async exportInfrastructure(@SocietyId() societyId: string): Promise<StreamableFile> {
    const csv = await this.adminService.exportInfrastructureCsv(societyId);
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('infrastructure/import/template')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="infrastructure-import-template.csv"')
  infrastructureImportTemplate(): StreamableFile {
    const csv = this.adminService.infrastructureImportTemplate();
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Post('infrastructure/import/preview')
  previewInfrastructureImport(
    @SocietyId() societyId: string,
    @Body('csv') csv: string,
  ) {
    return this.adminService.previewInfrastructureCsv(societyId, csv);
  }

  @Post('infrastructure/import')
  importInfrastructure(
    @SocietyId() societyId: string,
    @Body('csv') csv: string,
  ) {
    return this.adminService.importInfrastructureCsv(societyId, csv, false);
  }
}
