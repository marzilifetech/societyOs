import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { CreateVitalDto, CreateMedicationDto, UpdateMedicationDto, CreateHealthRecordDto } from './dto/health.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { HealthVitalType, UserRole } from '@prisma/client';

@ApiTags('health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RESIDENT)
@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  // ── Today summary ───────────────────────────────────────────────────────────

  @Get('today')
  getToday(@CurrentUser() user: JwtPayload) {
    return this.healthService.getToday(user.sub);
  }

  // ── Vitals ──────────────────────────────────────────────────────────────────

  @Get('vitals/summary')
  getVitalsSummary(@CurrentUser() user: JwtPayload) {
    return this.healthService.getVitalsSummary(user.sub);
  }

  @Get('vitals')
  getVitals(
    @CurrentUser() user: JwtPayload,
    @Query('type') type?: HealthVitalType,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.healthService.getVitals(user.sub, type, from, to);
  }

  @Get('vitals/:type')
  getVitalsByType(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
    @Query('days') days?: string,
  ) {
    return this.healthService.getVitalsByType(user.sub, type, days ? parseInt(days, 10) : undefined);
  }

  @Post('vitals')
  createVital(@CurrentUser() user: JwtPayload, @Body() dto: CreateVitalDto) {
    return this.healthService.createVital(user.sub, dto);
  }

  // ── Medications ─────────────────────────────────────────────────────────────

  @Get('medications/today')
  getMedicationsToday(@CurrentUser() user: JwtPayload) {
    return this.healthService.getMedicationsToday(user.sub);
  }

  @Get('medications')
  getMedications(@CurrentUser() user: JwtPayload) {
    return this.healthService.getMedications(user.sub);
  }

  @Post('medications')
  createMedication(@CurrentUser() user: JwtPayload, @Body() dto: CreateMedicationDto) {
    return this.healthService.createMedication(user.sub, dto);
  }

  @Patch('medications/doses/:id')
  toggleMedicationDose(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.healthService.toggleMedicationDose(id, user.sub);
  }

  @Put('medications/:id')
  updateMedication(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateMedicationDto) {
    return this.healthService.updateMedication(id, user.sub, dto);
  }

  @Delete('medications/:id')
  deleteMedication(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.healthService.deleteMedication(id, user.sub);
  }

  // ── Health Records ───────────────────────────────────────────────────────────

  @Get('records')
  getRecords(@CurrentUser() user: JwtPayload) {
    return this.healthService.getRecords(user.sub);
  }

  @Post('records')
  createRecord(@CurrentUser() user: JwtPayload, @Body() dto: CreateHealthRecordDto) {
    return this.healthService.createRecord(user.sub, dto);
  }

  @Get('records/:id/url')
  getRecordUrl(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.healthService.getRecordUrl(id, user.sub);
  }

  @Get('records/:id')
  getRecord(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.healthService.getRecord(id, user.sub);
  }

  @Delete('records/:id')
  deleteRecord(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.healthService.deleteRecord(id, user.sub);
  }
}
