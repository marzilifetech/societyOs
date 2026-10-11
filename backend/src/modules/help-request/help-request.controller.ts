import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HelpRequestService } from './help-request.service';
import { StaffHelpService } from './staff-help.service';
import {
  CompleteHelpRequestDto,
  CreateHelpRequestDto,
  UpdateHelpRequestStatusDto,
} from './dto/help-request.dto';
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
  getHelpRequestById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    return this.helpService.getHelpRequestById(id, user.sub, societyId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.RESIDENT)
  cancelHelpRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
  ) {
    return this.helpService.cancelHelpRequest(id, user.sub, societyId);
  }

  @Post(':id/rate')
  @Roles(UserRole.RESIDENT)
  rateHelpRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.helpService.rateHelpRequest(id, user.sub, societyId, body.rating, body.comment);
  }

  @Get(':id/photo-upload-url')
  @Roles(UserRole.RESIDENT, UserRole.STAFF)
  getPhotoUploadUrl(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Query('contentType') contentType?: string,
  ) {
    return this.helpService.getHelpRequestPhotoUploadUrl(id, societyId, contentType);
  }
}

@ApiTags('help-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff/help-requests')
@Roles(UserRole.STAFF)
export class StaffHelpRequestController {
  constructor(private staffHelp: StaffHelpService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string) {
    return this.staffHelp.list(user.sub, societyId);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string, @Param('id') id: string) {
    return this.staffHelp.get(user.sub, id, societyId);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string, @Param('id') id: string) {
    return this.staffHelp.accept(user.sub, id, societyId);
  }

  @Post(':id/decline')
  decline(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string, @Param('id') id: string) {
    return this.staffHelp.decline(user.sub, id, societyId);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHelpRequestStatusDto,
  ) {
    if (dto.status === 'IN_PROGRESS') return this.staffHelp.start(user.sub, id, societyId);
    if (dto.status === 'COMPLETED') return this.staffHelp.complete(user.sub, id, societyId, {});
    throw new ForbiddenException({
      code: 'STAFF_CANNOT_CANCEL',
      message: 'Decline the request instead; only the resident or an admin can cancel it.',
    });
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() dto: CompleteHelpRequestDto,
  ) {
    return this.staffHelp.complete(user.sub, id, societyId, dto);
  }
}
