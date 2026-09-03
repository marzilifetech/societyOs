import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MedicalService } from './medical.service';
import { CreateAppointmentDto } from './dto/medical.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppointmentStatus, UserRole } from '@prisma/client';

@ApiTags('medical')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('medical')
export class MedicalController {
  constructor(private medicalService: MedicalService) {}

  @Get('doctors')
  getDoctors(@SocietyId() societyId: string) {
    return this.medicalService.getDoctors(societyId);
  }

  @Get('staff')
  getMedicalStaff(@SocietyId() societyId: string) {
    return this.medicalService.getDoctors(societyId);
  }

  @Get('emergency-contacts')
  getEmergencyContacts(@SocietyId() societyId: string) {
    return this.medicalService.getEmergencyContacts(societyId);
  }

  @Get('doctors/:id/slots')
  getSlots(@Param('id') doctorId: string, @Query('date') date: string) {
    return this.medicalService.getSlots(doctorId, date);
  }

  @Get('doctors/:id')
  getDoctorById(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.medicalService.getDoctorById(id, societyId);
  }

  @Get('appointments/mine')
  getMyAppointmentsMine(@CurrentUser() user: JwtPayload) {
    return this.medicalService.getMyAppointments(user.sub);
  }

  @Get('appointments')
  getMyAppointments(@CurrentUser() user: JwtPayload) {
    return this.medicalService.getMyAppointments(user.sub);
  }

  @Get('appointments/:id')
  getAppointmentById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.medicalService.getAppointmentById(id, user.sub);
  }

  // Flat query param variant used by resident-app: GET /medical/slots?doctorId=X&date=Y
  @Get('slots')
  getSlotsQuery(@Query('doctorId') doctorId: string, @Query('date') date: string) {
    return this.medicalService.getSlots(doctorId, date);
  }

  @Post('appointments')
  bookAppointment(@CurrentUser() user: JwtPayload, @Body() dto: CreateAppointmentDto) {
    return this.medicalService.bookAppointment(user.sub, dto.doctorId, dto.date, dto.timeSlot);
  }

  @Patch('appointments/:id/cancel')
  cancelAppointment(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.medicalService.cancelAppointment(id, user.sub);
  }

  @Patch('appointments/:id/reschedule')
  rescheduleAppointment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { date?: string; timeSlot?: string; start?: string; slotId?: string },
  ) {
    const date = body.date ?? body.start ?? '';
    const timeSlot = body.timeSlot ?? body.slotId ?? '';
    return this.medicalService.rescheduleAppointment(id, user.sub, date, timeSlot);
  }

  @Post('appointments/:id/rate')
  rateAppointment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.medicalService.rateAppointment(id, user.sub, body.rating, body.comment);
  }

  // ── Doctor endpoints ─────────────────────────────────────────────────────────

  @Get('doctor/my-appointments')
  getDoctorAppointments(@CurrentUser() user: JwtPayload) {
    return this.medicalService.getDoctorAppointments(user.sub);
  }

  @Patch('doctor/availability')
  toggleDoctorAvailability(@CurrentUser() user: JwtPayload) {
    return this.medicalService.toggleDoctorAvailability(user.sub);
  }

  @Post('doctor/slots')
  setDoctorSlots(@CurrentUser() user: JwtPayload, @Body() dto: { availableDays: string[]; timeSlots: string[] }) {
    return this.medicalService.setDoctorSlots(user.sub, dto);
  }

  @Patch('appointments/:id/complete')
  completeAppointment(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.medicalService.completeAppointment(id, user.sub);
  }

  @Patch('appointments/:id/notes')
  addAppointmentNotes(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() body: { notes: string }) {
    return this.medicalService.addAppointmentNotes(id, user.sub, body.notes);
  }

  // ── Admin endpoints ──────────────────────────────────────────────────────────

  @Post('/admin/medical/staff')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createMedicalStaff(
    @SocietyId() societyId: string,
    @Body() dto: { name: string; designation: string; availableDays?: string[]; timeSlots?: string[] },
  ) {
    return this.medicalService.createMedicalStaff(societyId, dto);
  }

  @Get('/admin/medical/staff/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminMedicalStaffById(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.medicalService.getAdminMedicalStaffById(id, societyId);
  }

  @Get('/admin/medical/staff/:id/ratings')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminMedicalStaffRatings(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.medicalService.getAdminMedicalStaffRatings(id, societyId);
  }

  @Patch('/admin/medical/staff/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateMedicalStaff(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() dto: Record<string, any>,
  ) {
    return this.medicalService.updateMedicalStaff(id, societyId, dto);
  }

  @Patch('/admin/medical/staff/:id/reactivate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  reactivateMedicalStaff(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.medicalService.reactivateMedicalStaff(id, societyId);
  }

  @Patch('/admin/medical/appointments/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  adminUpdateAppointment(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() dto: { status: AppointmentStatus; notes?: string },
  ) {
    return this.medicalService.adminUpdateAppointment(id, societyId, dto);
  }

  @Delete('/admin/medical/staff/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deleteMedicalStaff(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.medicalService.deleteMedicalStaff(id, societyId);
  }

  @Get('/admin/medical/appointments')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminAppointments(
    @SocietyId() societyId: string,
    @Query('date') date?: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.medicalService.getAdminAppointments(societyId, date, doctorId);
  }

  @Get('/admin/sos/log')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getSosLog(@SocietyId() societyId: string) {
    return this.medicalService.getSosLog(societyId);
  }
}
