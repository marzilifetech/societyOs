import { Controller, Post, Patch, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SosService } from './sos.service';
import { SosGateway } from './sos.gateway';
import { TriggerSosDto, SosNoteUpdateDto } from './dto/sos.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/** Who may see and act on a society's open SOS alerts. ADMIN also admits BUILDING_ADMIN. */
const SOS_RESPONDER_ROLES = [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN] as const;

@ApiTags('sos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sos')
export class SosController {
  constructor(
    private sosService: SosService,
    private sosGateway: SosGateway,
  ) {}

  // Anti-spam: 5 SOS triggers per minute per (IP, userId) — see
  // AppThrottlerGuard.getTracker for the composite key on /sos/trigger.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('trigger')
  async trigger(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: TriggerSosDto,
  ) {
    const alert = await this.sosService.trigger(user.sub, societyId, dto.lat, dto.lng, 'resident');
    this.sosGateway.emitSosAlert(societyId, alert);
    return alert;
  }

  /** Staff SOS — same alert pipeline; optional note + location (e.g. at a resident unit). */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('staff')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF)
  async triggerStaff(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: TriggerSosDto,
  ) {
    const alert = await this.sosService.trigger(user.sub, societyId, dto.lat, dto.lng, 'staff');
    this.sosGateway.emitSosAlert(societyId, alert);
    return alert;
  }

  /** Appends a note after SOS was sent (same sender only). */
  @Patch(':id/note')
  async appendNote(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SosNoteUpdateDto,
  ) {
    return this.sosService.appendNote(id, user, dto.note);
  }

  /** Responders only, within their own society (see SosService.acknowledge). */
  @Patch(':id/acknowledge')
  @UseGuards(RolesGuard)
  @Roles(...SOS_RESPONDER_ROLES)
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    const alert = await this.sosService.acknowledge(id, user.sub, societyId);
    this.sosGateway.emitSosAcknowledged(societyId, id, user.sub);
    return alert;
  }

  /** Responders, or the person who raised the alert (checked in the service). */
  @Patch(':id/resolve')
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    const alert = await this.sosService.resolve(id, societyId, user);
    this.sosGateway.emitSosResolved(societyId, id);
    return alert;
  }

  /** Alias for clients expecting POST /sos/:id/cancel (same as marking a false alarm). */
  @Post(':id/cancel')
  cancelSos(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    return this.sosService.flagFalseAlarm(id, user, societyId);
  }

  @Patch(':id/false-alarm')
  flagFalseAlarm(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    return this.sosService.flagFalseAlarm(id, user, societyId);
  }

  /** Resident's own SOS alert history. */
  @Get('history')
  getHistory(@CurrentUser() user: JwtPayload) {
    return this.sosService.getHistory(user.sub);
  }

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(...SOS_RESPONDER_ROLES)
  getActive(@SocietyId() societyId: string) {
    return this.sosService.getActive(societyId);
  }
}

class AddSosResponderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/sos')
export class AdminSosController {
  constructor(private sosService: SosService) {}

  @Get('responders')
  listResponders(@SocietyId() societyId: string) {
    return this.sosService.listResponders(societyId);
  }

  @Post('responders')
  addResponder(@SocietyId() societyId: string, @Body() dto: AddSosResponderDto) {
    return this.sosService.addResponder(societyId, dto.userId);
  }

  @Delete('responders/:id')
  removeResponder(@SocietyId() societyId: string, @Param('id') id: string) {
    return this.sosService.removeResponder(societyId, id);
  }
}
