import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NoticeService } from './notice.service';
import { CreateNoticeDto, BroadcastDto, UpdateNoticeDto } from './dto/notice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('notices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('notices')
export class NoticeController {
  constructor(private noticeService: NoticeService) {}

  @Get()
  getNotices(
    @SocietyId() societyId: string,
    @Query('pinned') pinned?: string,
    @Query('limit') limit?: string,
  ) {
    const onlyPinned = pinned === 'true' || pinned === '1';
    const parsedLimit = limit ? Math.max(1, Math.min(50, parseInt(limit, 10) || 0)) : undefined;
    return this.noticeService.getNotices(societyId, { onlyPinned, limit: parsedLimit });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createNotice(@SocietyId() societyId: string, @Body() dto: CreateNoticeDto) {
    return this.noticeService.createNotice(societyId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deleteNotice(@Param('id', ParseUUIDPipe) id: string, @SocietyId() societyId: string) {
    return this.noticeService.deleteNotice(id, societyId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateNotice(
    @Param('id', ParseUUIDPipe) id: string,
    @SocietyId() societyId: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.noticeService.updateNotice(id, societyId, dto);
  }

  @Patch(':id/unpin')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  unpinNotice(@Param('id', ParseUUIDPipe) id: string, @SocietyId() societyId: string) {
    return this.noticeService.updateNotice(id, societyId, { isPinned: false } as UpdateNoticeDto);
  }

  @Patch(':id/pin')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  pinNotice(@Param('id', ParseUUIDPipe) id: string, @SocietyId() societyId: string) {
    return this.noticeService.pinNotice(id, societyId);
  }

  @Post('broadcast')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  broadcastEmergency(@SocietyId() societyId: string, @Body() dto: BroadcastDto) {
    return this.noticeService.broadcastEmergency(societyId, dto);
  }

  @Get('broadcasts')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getEmergencyBroadcasts(@SocietyId() societyId: string) {
    return this.noticeService.getEmergencyBroadcasts(societyId, 5);
  }

  @Get('polls')
  getPolls(@SocietyId() societyId: string, @CurrentUser() user: JwtPayload) {
    return this.noticeService.getPolls(societyId, user.sub);
  }

  @Post(':id/vote')
  @Roles(UserRole.RESIDENT)
  voteOnNotice(
    @Param('id') pollId: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() body: { optionId?: number | string; options?: number[] },
  ) {
    const opts = body.options ?? (body.optionId != null ? [Number(body.optionId)] : []);
    return this.noticeService.vote(pollId, user.sub, societyId, opts);
  }

  @Get(':id/results')
  getNoticeResults(@SocietyId() societyId: string, @Param('id') pollId: string) {
    return this.noticeService.getPollResults(pollId, societyId);
  }

  @Post('polls/:id/vote')
  @Roles(UserRole.RESIDENT)
  vote(
    @Param('id') pollId: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() body: { options?: number[]; optionId?: number | string },
  ) {
    const opts = body.options ?? (body.optionId != null ? [Number(body.optionId)] : []);
    return this.noticeService.vote(pollId, user.sub, societyId, opts);
  }

  @Get('polls/:id/results')
  getPollResults(@SocietyId() societyId: string, @Param('id') pollId: string) {
    return this.noticeService.getPollResults(pollId, societyId);
  }

  // ── Admin endpoints ──────────────────────────────────────────────────────────

  @Post('/admin/polls')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createPoll(
    @SocietyId() societyId: string,
    @Body() dto: { question: string; options: string[]; deadline: string; isAnonymous: boolean },
  ) {
    return this.noticeService.createPoll(societyId, dto);
  }

  @Get('/admin/polls')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAllPolls(@SocietyId() societyId: string) {
    return this.noticeService.getAllPolls(societyId);
  }

  @Get('/admin/polls/:id/results')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getPollResultsAdmin(@SocietyId() societyId: string, @Param('id') pollId: string) {
    return this.noticeService.getPollResults(pollId, societyId);
  }

  @Patch('/admin/polls/:id/close')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  closePoll(@Param('id') pollId: string, @SocietyId() societyId: string) {
    return this.noticeService.closePoll(pollId, societyId);
  }

  // ── Property admin endpoints ─────────────────────────────────────────────────

  @Get('/admin/property/listings')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getPropertyListings(@SocietyId() societyId: string, @Query('status') status?: string) {
    return this.noticeService.getPropertyListings(societyId, status);
  }

  @Post('/admin/property/listings/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  approvePropertyListing(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.noticeService.approvePropertyListing(id, societyId);
  }

  @Patch('/admin/property/listings/:id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  rejectPropertyListing(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() body: { reason?: string },
  ) {
    return this.noticeService.rejectPropertyListing(id, societyId, body?.reason);
  }

  // ── Travel admin endpoints ───────────────────────────────────────────────────

  @Get('/admin/travel/pauses')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getTravelPauses(@SocietyId() societyId: string, @Query('status') status?: string) {
    return this.noticeService.getTravelPauses(societyId, status);
  }

  @Post('/admin/travel/pauses/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  approveTravelPause(@Param('id') id: string) {
    return this.noticeService.approveTravelPause(id);
  }

  @Patch('/admin/travel/pauses/:id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  rejectTravelPause(@Param('id') id: string) {
    return this.noticeService.rejectTravelPause(id);
  }

  // ── Resident Travel Pause endpoints ───────────────────────

  @Post('/travel/pauses')
  @Roles(UserRole.RESIDENT)
  createTravelPause(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: { startDate: string; returnDate: string; servicesPaused: string[]; reason?: string },
  ) {
    return this.noticeService.createTravelPause(user.sub, societyId, dto);
  }

  @Get('/travel/pauses/my')
  @Roles(UserRole.RESIDENT)
  getMyTravelPauses(@CurrentUser() user: JwtPayload) {
    return this.noticeService.getMyTravelPauses(user.sub);
  }

  @Patch('/travel/pauses/:id/return')
  @Roles(UserRole.RESIDENT)
  reportReturn(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: { actualReturnDate: string },
  ) {
    return this.noticeService.reportTravelReturn(user.sub, id, dto.actualReturnDate);
  }

  // ── Resident Property Listing endpoints ───────────────────

  @Post('/property/listings')
  @Roles(UserRole.RESIDENT)
  createPropertyListing(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: { areaSqft: number; price: number; furnished: boolean; description?: string },
  ) {
    return this.noticeService.createPropertyListing(user.sub, societyId, dto);
  }

  @Get('/property/listings/my')
  @Roles(UserRole.RESIDENT)
  getMyPropertyListings(@CurrentUser() user: JwtPayload) {
    return this.noticeService.getMyListingsFromUser(user.sub);
  }

  @Get('/property/listings')
  getAllPropertyListings(@SocietyId() societyId: string) {
    return this.noticeService.getAllListingsForSociety(societyId);
  }

  @Post('/property/listings/:id/interest')
  @Roles(UserRole.RESIDENT)
  expressInterest(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
  ) {
    return this.noticeService.expressPropertyInterest(user.sub, societyId, id);
  }
}
