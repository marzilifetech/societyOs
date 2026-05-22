import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TravelPauseService } from './travel-pause.service';
import { CreateTravelPauseDto } from './dto/travel-pause.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('travel-pauses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('travel-pauses')
export class TravelPauseController {
  constructor(private service: TravelPauseService) {}

  @Get('my')
  @Roles(UserRole.RESIDENT)
  getMyPauses(@CurrentUser() user: JwtPayload) {
    return this.service.findByResident(user.sub);
  }

  @Post()
  @Roles(UserRole.RESIDENT)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTravelPauseDto) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id/return')
  @Roles(UserRole.RESIDENT)
  markReturned(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markReturned(id, user.sub);
  }
}

@ApiTags('travel-pauses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/travel-pauses')
export class AdminTravelPauseController {
  constructor(private service: TravelPauseService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  list(
    @SocietyId() societyId: string,
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.service.findBySociety(societyId, status, user.managedBlocks);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  approve(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.service.approve(id, societyId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  reject(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.service.reject(id, societyId);
  }
}
