import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicles')
export class VehicleController {
  constructor(private vehicleService: VehicleService) {}

  @Get()
  @Roles(UserRole.RESIDENT)
  findMy(@CurrentUser() user: JwtPayload) {
    return this.vehicleService.findMy(user.sub);
  }

  @Get('entry-log')
  @Roles(UserRole.RESIDENT)
  getEntryLog(@CurrentUser() user: JwtPayload) {
    return this.vehicleService.getEntryLogForResident(user.sub);
  }

  @Post()
  @Roles(UserRole.RESIDENT)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVehicleDto) {
    return this.vehicleService.create(user.sub, dto);
  }

  @Patch(':id')
  @Roles(UserRole.RESIDENT)
  update(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateVehicleDto) {
    return this.vehicleService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(UserRole.RESIDENT)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.vehicleService.remove(id, user.sub);
  }
}
