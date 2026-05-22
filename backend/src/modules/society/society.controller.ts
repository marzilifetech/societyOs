import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SocietyService } from './society.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { UserRole } from '@prisma/client';
import {
  CreateSocietyBudgetDto,
  UpdateSocietyBudgetDto,
  BudgetQueryDto,
  CreateBylawDto,
  UpdateBylawDto,
} from './dto/society.dto';

@ApiTags('society')
@Controller('societies')
export class SocietyController {
  constructor(private societyService: SocietyService) {}

  @Get()
  findAll() {
    return this.societyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.societyService.findOne(id);
  }

  @Get(':id/flats')
  getFlats(@Param('id') id: string) {
    return this.societyService.getFlats(id);
  }

  // ─── Budget ───────────────────────────────────────────────────────────────

  @Get('budget')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RESIDENT)
  getBudget(@SocietyId() societyId: string, @Query() query: BudgetQueryDto) {
    return this.societyService.getBudget(societyId, query.year, query.month);
  }

  @Post('budget')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createBudget(@SocietyId() societyId: string, @Body() dto: CreateSocietyBudgetDto) {
    return this.societyService.createBudget(societyId, dto);
  }

  @Patch('budget/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateBudget(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() dto: UpdateSocietyBudgetDto,
  ) {
    return this.societyService.updateBudget(id, societyId, dto);
  }

  // ─── Bylaws ───────────────────────────────────────────────────────────────

  @Get('bylaws')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RESIDENT)
  getBylaws(@SocietyId() societyId: string) {
    return this.societyService.getBylaws(societyId);
  }

  @Post('bylaws')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createBylaw(@SocietyId() societyId: string, @Body() dto: CreateBylawDto) {
    return this.societyService.createBylaw(societyId, dto);
  }

  @Patch('bylaws/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateBylaw(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() dto: UpdateBylawDto,
  ) {
    return this.societyService.updateBylaw(societyId, id, dto);
  }

  @Delete('bylaws/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deleteBylaw(@Param('id') id: string, @SocietyId() societyId: string) {
    return this.societyService.deleteBylaw(societyId, id);
  }
}
