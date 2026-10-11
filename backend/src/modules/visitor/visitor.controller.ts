import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VisitorService } from './visitor.service';
import {
  CreateAtGateVisitorDto,
  CreateVisitorDto,
  CheckInVisitorDto,
  VisitorDecisionDto,
} from './dto/visitor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/**
 * Every route says who may call it. There was no role guard here at all, so a
 * resident could log "visitor at the gate" entries against any flat (an
 * actionable push to that resident) and check visitors in and out.
 */
const GATE_ROLES = [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN] as const;

@ApiTags('visitors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('visitors')
export class VisitorController {
  constructor(private visitorService: VisitorService) {}

  @Post()
  @Roles(UserRole.RESIDENT)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVisitorDto) {
    return this.visitorService.create(user.sub, user.societyId, dto);
  }

  @Get('my')
  @Roles(UserRole.RESIDENT)
  myVisitors(@CurrentUser() user: JwtPayload) {
    return this.visitorService.findByResident(user.sub, user.societyId);
  }

  @Get('qr/:token')
  @Roles(...GATE_ROLES)
  findByQr(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.visitorService.findByQr(token, user.societyId);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.visitorService.findById(id, user.societyId, user.sub);
  }

  /** Guard-side walk-in: creates a PENDING visitor and fires an actionable push. */
  @Post('at-gate')
  @Roles(...GATE_ROLES)
  createAtGate(@CurrentUser() user: JwtPayload, @Body() dto: CreateAtGateVisitorDto) {
    return this.visitorService.createAtGate(user.sub, user.societyId, dto);
  }

  @Post('check-in')
  @Roles(...GATE_ROLES)
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInVisitorDto) {
    return this.visitorService.checkIn(dto, user.sub, user.societyId);
  }

  @Patch(':id/check-out')
  @Roles(...GATE_ROLES)
  checkOut(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.visitorService.checkOut(id, user.societyId);
  }

  @Patch(':id/deny')
  @Roles(UserRole.RESIDENT)
  deny(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.visitorService.deny(id, user.societyId, user.sub);
  }

  /** Resident approve/reject from the actionable visitor push (idempotent). */
  @Post(':id/decision')
  @Roles(UserRole.RESIDENT)
  decide(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: VisitorDecisionDto,
  ) {
    return this.visitorService.decide(id, user.societyId, user.sub, dto.action);
  }
}
