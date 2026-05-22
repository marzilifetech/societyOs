import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AgmService } from './agm.service';
import { VoteDto, CastResolutionVoteDto, AssignProxyDto, CreateResolutionDto } from './dto/agm.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('agm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agm')
export class AgmController {
  constructor(private agmService: AgmService) {}

  @Get('meetings')
  getMeetings(@SocietyId() societyId: string) {
    return this.agmService.getMeetings(societyId);
  }

  @Get('meetings/:id/results')
  getResults(@Param('id') id: string) {
    return this.agmService.getResults(id);
  }

  @Post('meetings/:id/vote')
  @Roles(UserRole.RESIDENT)
  vote(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: VoteDto) {
    return this.agmService.vote(id, user.sub, dto);
  }

  @Get('meetings/:id')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getMeeting(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.agmService.getMeetingWithMyVotes(id, user.sub);
  }

  @Post('resolutions')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createResolution(@SocietyId() societyId: string, @Body() dto: CreateResolutionDto) {
    return this.agmService.createResolution(societyId, dto);
  }

  @Post('resolutions/:id/vote')
  @Roles(UserRole.RESIDENT)
  castVote(
    @Param('id') resolutionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CastResolutionVoteDto,
  ) {
    return this.agmService.castResolutionVote(resolutionId, user.sub, dto.vote);
  }

  @Post('resolutions/:id/proxy')
  @Roles(UserRole.RESIDENT)
  assignProxy(
    @Param('id') resolutionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AssignProxyDto,
  ) {
    return this.agmService.assignProxy(resolutionId, user.sub, dto.residentId);
  }
}
