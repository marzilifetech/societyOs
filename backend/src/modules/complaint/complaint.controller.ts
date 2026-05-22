import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ComplaintService } from './complaint.service';
import { CreateComplaintDto, RateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('complaints')
export class ComplaintController {
  constructor(private complaintService: ComplaintService) {}

  @Post()
  @Roles(UserRole.RESIDENT)
  create(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaintService.create(user.sub, societyId, dto);
  }

  @Get('my')
  @Roles(UserRole.RESIDENT)
  myComplaints(@CurrentUser() user: JwtPayload) {
    return this.complaintService.findByResident(user.sub);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.complaintService.findOne(id, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  all(
    @SocietyId() societyId: string,
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.complaintService.findBySociety(societyId, status, user.managedBlocks);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateComplaintStatusDto) {
    return this.complaintService.update(id, dto);
  }

  @Post(':id/rate')
  @Roles(UserRole.RESIDENT)
  rate(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: RateComplaintDto) {
    return this.complaintService.rate(id, user.sub, dto);
  }
}
