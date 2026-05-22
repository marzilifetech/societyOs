import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PackageService } from './package.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('packages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('packages')
export class PackageController {
  constructor(private packageService: PackageService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  logArrival(@CurrentUser() user: JwtPayload, @Body() dto: {
    residentId: string;
    courierName: string;
    trackingNumber?: string;
    description?: string;
    photoUrl: string;
  }) {
    return this.packageService.logArrival(user.sub, user.societyId, dto);
  }

  @Get('my')
  @Roles(UserRole.RESIDENT)
  myPackages(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.packageService.findByResident(user.sub, user.societyId, +page, +limit);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  bySociety(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.packageService.findBySociety(user.societyId, +page, +limit);
  }

  @Patch(':id/collect')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  markCollected(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.packageService.markCollected(id, user.societyId);
  }
}
