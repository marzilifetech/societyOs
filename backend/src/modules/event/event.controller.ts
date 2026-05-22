import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events')
export class EventController {
  constructor(private eventService: EventService) {}

  @Get()
  getEvents(@SocietyId() societyId: string, @CurrentUser() user: JwtPayload) {
    return this.eventService.getEvents(
      societyId,
      user.role === UserRole.RESIDENT ? user.sub : undefined,
    );
  }

  @Get(':id')
  getEvent(@Param('id') id: string) {
    return this.eventService.getEvent(id);
  }

  @Post(':id/register')
  @Roles(UserRole.RESIDENT)
  register(@Param('id') eventId: string, @CurrentUser() user: JwtPayload) {
    return this.eventService.register(eventId, user.sub);
  }

  @Delete(':id/register')
  @Roles(UserRole.RESIDENT)
  cancelRegistrationDelete(@Param('id') eventId: string, @CurrentUser() user: JwtPayload) {
    return this.eventService.cancelRegistration(eventId, user.sub);
  }

  // PATCH alias used by resident-app
  @Patch(':id/cancel-registration')
  @Roles(UserRole.RESIDENT)
  cancelRegistrationPatch(@Param('id') eventId: string, @CurrentUser() user: JwtPayload) {
    return this.eventService.cancelRegistration(eventId, user.sub);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@SocietyId() societyId: string, @Body() dto: CreateEventDto) {
    return this.eventService.create(societyId, dto);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  cancel(@Param('id') id: string) {
    return this.eventService.cancelEvent(id);
  }

  @Post(':id/feedback')
  @Roles(UserRole.RESIDENT)
  submitFeedback(
    @Param('id') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Body('rating') rating?: number,
    @Body('ratings') ratings?: { overall?: number },
    @Body('comment') comment?: string,
    @Body('feedback') feedback?: string,
  ) {
    const resolvedRating = rating ?? ratings?.overall ?? 0;
    const resolvedComment = comment ?? feedback;
    return this.eventService.submitFeedback(eventId, user.sub, resolvedRating, resolvedComment);
  }
}
