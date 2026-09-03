import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ParseEntityIdPipe } from '../../common/pipes/parse-entity-id.pipe';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PestControlService } from './pest-control.service';
import { CreatePestControlDto } from './dto/create-pest-control.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('pest-control')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('pest-control')
export class PestControlController {
  constructor(private pestControlService: PestControlService) {}

  @Get()
  @Roles(UserRole.RESIDENT)
  findUpcoming(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.pestControlService.findUpcoming(user.sub, +page, +limit);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  findOne(@Param('id', ParseEntityIdPipe) id: string, @SocietyId() societyId: string) {
    return this.pestControlService.findOne(id, societyId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@SocietyId() societyId: string, @Body() dto: CreatePestControlDto) {
    return this.pestControlService.create(societyId, dto);
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  complete(@Param('id', ParseEntityIdPipe) id: string, @SocietyId() societyId: string) {
    return this.pestControlService.complete(id, societyId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  cancel(@Param('id', ParseEntityIdPipe) id: string, @SocietyId() societyId: string) {
    return this.pestControlService.cancel(id, societyId);
  }
}
