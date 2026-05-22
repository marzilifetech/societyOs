import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InfrastructureService } from './infrastructure.service';
import { ReportIncidentDto, UpdateStatusDto, ResolveIncidentDto } from './dto/infrastructure.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('infrastructure')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('infrastructure')
export class InfrastructureController {
  constructor(private infrastructureService: InfrastructureService) {}

  @Get('status')
  getStatus(@SocietyId() societyId: string) {
    return this.infrastructureService.getStatus(societyId);
  }

  @Post('report')
  reportIncident(@CurrentUser() user: JwtPayload, @Body() dto: ReportIncidentDto) {
    return this.infrastructureService.reportIncident(user.sub, dto);
  }

  @Patch('incidents/:id/resolve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  resolveIncident(@Param('id') id: string, @Body() dto: ResolveIncidentDto) {
    return this.infrastructureService.resolveIncident(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  updateStatus(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateStatusDto) {
    return this.infrastructureService.updateStatus(id, user.sub, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.infrastructureService.findOne(id);
  }
}
