import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DomesticHelpService } from './domestic-help.service';
import { CreateDomesticHelpDto, UpdateDomesticHelpDto, MarkAttendanceDto } from './dto/domestic-help.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('domestic-help')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('domestic-help')
export class DomesticHelpController {
  constructor(private domesticHelpService: DomesticHelpService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDomesticHelpDto) {
    return this.domesticHelpService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.domesticHelpService.findAll(user.sub);
  }

  @Put(':id')
  update(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateDomesticHelpDto) {
    return this.domesticHelpService.update(id, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.domesticHelpService.remove(id, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.domesticHelpService.findOne(id, user.sub);
  }

  @Post(':id/attendance')
  markAttendance(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: MarkAttendanceDto) {
    return this.domesticHelpService.markAttendance(id, user.sub, dto);
  }

  @Get(':id/attendance')
  getAttendance(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Query('month') month: string) {
    return this.domesticHelpService.getAttendance(id, user.sub, month);
  }

  @Post(':id/salary')
  getSalary(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.domesticHelpService.getSalary(id, user.sub);
  }
}
