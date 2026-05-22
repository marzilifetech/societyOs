import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StaffCommunityService } from './staff-community.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('staff-community')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff/community')
export class StaffCommunityController {
  constructor(private community: StaffCommunityService) {}

  @Get('notices')
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getNotices(@SocietyId() societyId: string) {
    return this.community.getNotices(societyId);
  }

  @Get('groups')
  @Roles(UserRole.STAFF)
  getMyGroups(@CurrentUser() user: JwtPayload) {
    return this.community.getMyGroups(user.sub);
  }

  @Get('messages/:groupId')
  @Roles(UserRole.STAFF)
  getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.community.getMessages(user.sub, groupId, cursor);
  }

  @Post('messages/:groupId')
  @Roles(UserRole.STAFF)
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body('body') body: string,
  ) {
    return this.community.sendMessage(user.sub, groupId, body);
  }

  @Get('training')
  @Roles(UserRole.STAFF)
  getTraining(@SocietyId() societyId: string, @Query('category') category?: string) {
    return this.community.getTrainingMaterials(societyId, category);
  }

  @Get('recognition')
  @Roles(UserRole.STAFF)
  getRecognitions(@SocietyId() societyId: string, @Query('staffId') staffId?: string) {
    return this.community.getRecognitions(societyId, staffId);
  }

  @Post('recognition')
  @Roles(UserRole.STAFF)
  sendKudos(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: { staffId: string; message: string },
  ) {
    return this.community.sendKudos(user.sub, societyId, dto);
  }

  @Get('staff-list')
  @Roles(UserRole.STAFF)
  getStaffList(@SocietyId() societyId: string) {
    return this.community.getStaffList(societyId);
  }
}
