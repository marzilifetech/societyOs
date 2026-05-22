import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Header, StreamableFile, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
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
  constructor(private adminService: AdminService) {}

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
  updateSociety(
    @SocietyId() societyId: string,
    @Body()
    dto: {
      name?: string;
      address?: string;
      city?: string;
      pincode?: string;
      contactEmail?: string;
      contactPhone?: string;
      config?: Record<string, unknown>;
    },
  ) {
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

  @Get('residents/pending')
  getPendingResidents(@CurrentUser() user: JwtPayload) {
    return this.adminService.getPendingResidents(user.societyId, user.managedBlocks);
  }

  @Get('residents')
  getResidents(@SocietyId() societyId: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.getResidents(societyId, user.managedBlocks);
  }

  @Patch('residents/:id/approve')
  approveResident(@Param('id') id: string) {
    return this.adminService.approveResident(id);
  }

  @Patch('residents/:id/reject')
  rejectResident(@Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.rejectResident(id, reason || 'No reason provided');
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
  createStaff(
    @SocietyId() societyId: string,
    @Body() dto: {
      phone: string;
      name: string;
      designation: string;
      categories: string[];
      salary?: number;
    },
  ) {
    return this.adminService.createStaff(societyId, dto);
  }

  @Patch('staff/:id/transfer')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  transferStaff(
    @Param('id') id: string,
    @Body() dto: { toSocietyId: string; reason?: string },
  ) {
    return this.adminService.transferStaff(id, dto.toSocietyId, dto.reason);
  }

  @Patch('staff/:id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deactivateStaff(@Param('id') id: string) {
    return this.adminService.deactivateStaff(id);
  }

  @Get('staff/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffDetail(@Param('id') id: string) {
    return this.adminService.getStaffDetail(id);
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
  updateStaff(@Param('id') id: string, @Body() body: { salaryStructure?: Record<string, any> }) {
    return this.adminService.updateStaff(id, body);
  }

  @Get('staff/:id/documents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffDocuments(@Param('id') id: string) {
    return this.adminService.getStaffDocuments(id);
  }

  @Get('staff/:id/salary-slips')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStaffSalarySlips(@Param('id') id: string) {
    return this.adminService.getStaffSalarySlips(id);
  }

  @Get('residents/:id/documents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getResidentDocuments(@Param('id') id: string) {
    return this.adminService.getResidentDocuments(id);
  }

  @Patch('residents/:id/documents/verify')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  verifyResidentDocuments(
    @Param('id') id: string,
    @Body() body: { status: 'VERIFIED' | 'REJECTED'; note?: string },
  ) {
    return this.adminService.verifyResidentDocuments(id, body.status, body.note);
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
    @Body()
    dto: {
      title: string;
      body: string;
      targetType: 'ALL' | 'FLAT' | 'BLOCK' | 'INDIVIDUAL';
      targetIds?: string[];
      scheduledAt?: string;
    },
  ) {
    return this.adminService.sendPushNotification(societyId, dto);
  }

  // ─── M12: SOS Recipients ──────────────────────────────────────────────────

  @Get('sos/recipients')
  getSosRecipients(@SocietyId() societyId: string) {
    return this.adminService.getSosRecipients(societyId);
  }

  @Post('sos/recipients')
  addSosRecipient(
    @SocietyId() societyId: string,
    @Body() dto: { name: string; phone: string; email?: string; role?: string },
  ) {
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

  // ── Building Admins ──────────────────────────────────────────────────────────

  @Get('building-admins')
  @Roles(UserRole.SUPER_ADMIN)
  listBuildingAdmins(@SocietyId() societyId: string) {
    return this.adminService.listBuildingAdmins(societyId);
  }

  @Post('building-admins')
  @Roles(UserRole.SUPER_ADMIN)
  createBuildingAdmin(
    @SocietyId() societyId: string,
    @Body() dto: { name: string; phone: string; managedBlocks: string[] },
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
}
