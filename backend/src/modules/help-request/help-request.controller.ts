import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HelpRequestService } from './help-request.service';
import { CreateHelpRequestDto, UpdateHelpRequestStatusDto } from './dto/help-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('help-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('help-requests')
export class HelpRequestController {
  constructor(private helpService: HelpRequestService) {}

  @Get()
  @Roles(UserRole.RESIDENT)
  getResidentHelpRequests(@CurrentUser() user: JwtPayload) {
    return this.helpService.getResidentHelpRequests(user.sub);
  }

  @Post()
  @Roles(UserRole.RESIDENT)
  createHelpRequest(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CreateHelpRequestDto,
  ) {
    return this.helpService.createHelpRequest(user.sub, societyId, dto);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT)
  getHelpRequestById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.helpService.getHelpRequestById(id, user.sub);
  }

  @Get(':id/photo-upload-url')
  @Roles(UserRole.RESIDENT, UserRole.STAFF)
  getPhotoUploadUrl(@Param('id') id: string, @Query('contentType') contentType?: string) {
    return this.helpService.getHelpRequestPhotoUploadUrl(id, contentType);
  }
}

@ApiTags('help-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff/help-requests')
export class StaffHelpRequestController {
  constructor(private helpService: HelpRequestService) {}

  @Get()
  @Roles(UserRole.STAFF)
  getMyHelpRequests(@CurrentUser() user: JwtPayload) {
    return this.helpService.getMyHelpRequests(user.sub);
  }

  @Get(':id')
  @Roles(UserRole.STAFF)
  getMyHelpRequestById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.helpService.getMyHelpRequestById(user.sub, id);
  }

  @Post(':id/accept')
  @Roles(UserRole.STAFF)
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.helpService.acceptHelpRequest(user.sub, id);
  }

  @Patch(':id/status')
  @Roles(UserRole.STAFF)
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHelpRequestStatusDto,
  ) {
    return this.helpService.updateHelpRequestStatus(user.sub, id, dto.status);
  }

  @Post(':id/complete')
  @Roles(UserRole.STAFF)
  complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.helpService.completeHelpRequest(user.sub, id);
  }
}
