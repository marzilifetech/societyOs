import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AmenityService } from './amenity.service';
import {
  CreateAmenityBookingDto,
  RateAmenityBookingDto,
  CreateAmenityDto,
  UpdateAmenityDto,
} from './dto/amenity.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('amenities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('amenities')
export class AmenityController {
  constructor(private amenityService: AmenityService) {}

  @Get()
  findAll(@SocietyId() societyId: string) {
    return this.amenityService.findAll(societyId);
  }

  @Get('bookings/my')
  myBookings(@CurrentUser() user: JwtPayload) {
    return this.amenityService.myBookings(user.sub);
  }

  @Post('bookings')
  createBooking(@CurrentUser() user: JwtPayload, @Body() dto: CreateAmenityBookingDto) {
    return this.amenityService.createBooking(user.sub, dto);
  }

  @Post('bookings/:id/rating')
  rateBooking(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: RateAmenityBookingDto) {
    return this.amenityService.rateBooking(id, user.sub, dto);
  }

  @Delete('bookings/:id')
  cancelBooking(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.amenityService.cancelBooking(id, user.sub);
  }

  @Get(':id/availability')
  getAvailability(@Param('id') id: string, @Query('date') date: string) {
    return this.amenityService.getAvailability(id, date);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.amenityService.findOne(id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/amenities')
export class AdminAmenityController {
  constructor(private amenityService: AmenityService) {}

  @Get()
  findAll(@SocietyId() societyId: string) {
    return this.amenityService.adminFindAll(societyId);
  }

  @Post()
  create(@SocietyId() societyId: string, @Body() dto: CreateAmenityDto) {
    return this.amenityService.adminCreate(societyId, dto);
  }

  @Patch(':id')
  update(
    @SocietyId() societyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAmenityDto,
  ) {
    return this.amenityService.adminUpdate(societyId, id, dto);
  }
}
