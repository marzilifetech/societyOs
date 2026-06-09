import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VisitorService } from './visitor.service';
import { CreateVisitorDto, CheckInVisitorDto, VisitorDecisionDto } from './dto/visitor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('visitors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard)
@Controller('visitors')
export class VisitorController {
  constructor(private visitorService: VisitorService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVisitorDto) {
    return this.visitorService.create(user.sub, user.societyId, dto);
  }

  @Get('my')
  myVisitors(@CurrentUser() user: JwtPayload) {
    return this.visitorService.findByResident(user.sub, user.societyId);
  }

  @Get('qr/:token')
  findByQr(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.visitorService.findByQr(token, user.societyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.visitorService.findById(id, user.societyId, user.sub);
  }

  @Post('check-in')
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInVisitorDto) {
    return this.visitorService.checkIn(dto, user.sub, user.societyId);
  }

  @Patch(':id/check-out')
  checkOut(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.visitorService.checkOut(id, user.societyId);
  }

  @Patch(':id/deny')
  deny(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.visitorService.deny(id, user.societyId, user.sub);
  }

  /** Resident approve/reject from the actionable visitor push (idempotent). */
  @Post(':id/decision')
  decide(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: VisitorDecisionDto,
  ) {
    return this.visitorService.decide(id, user.societyId, user.sub, dto.action);
  }
}
