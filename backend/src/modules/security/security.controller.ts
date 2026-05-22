import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { SecurityService } from './security.service';

@Controller('security')
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  // --- Incidents ---

  @Get('incidents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getIncidents(@SocietyId() societyId: string, @Query('status') status?: string) {
    return this.securityService.getIncidents(societyId, status);
  }

  @Post('incidents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  reportIncident(
    @SocietyId() societyId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: { type: string; description: string; severity?: string },
  ) {
    return this.securityService.reportIncident(societyId, user.sub, dto);
  }

  @Patch('incidents/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateIncident(
    @Param('id') id: string,
    @Body() dto: { status?: string; resolution?: string },
  ) {
    return this.securityService.updateIncident(id, dto);
  }

  // --- Rounds ---

  @Post('rounds/start')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  startRound(@SocietyId() societyId: string, @CurrentUser() user: JwtPayload) {
    return this.securityService.startRound(societyId, user.sub);
  }

  @Patch('rounds/:id/complete')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF)
  completeRound(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: { notes?: string },
  ) {
    return this.securityService.completeRound(id, user.sub, dto.notes);
  }

  @Get('rounds')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getRounds(@SocietyId() societyId: string, @Query('date') date?: string) {
    return this.securityService.getRounds(societyId, date);
  }
}
