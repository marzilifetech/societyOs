import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ParseEntityIdPipe } from '../../common/pipes/parse-entity-id.pipe';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto, PauseSubscriptionDto, CancelSubscriptionDto } from './dto/create-subscription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Roles(UserRole.RESIDENT)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.subscriptionService.findAll(user.sub, +page, +limit);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.create(user.sub, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.subscriptionService.findOne(id, user.sub);
  }

  @Patch(':id/pause')
  pause(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: JwtPayload, @Body() dto: PauseSubscriptionDto) {
    return this.subscriptionService.pause(id, user.sub, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: JwtPayload, @Body() dto: CancelSubscriptionDto) {
    return this.subscriptionService.cancel(id, user.sub, dto);
  }

  @Post(':id/resume')
  resume(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.subscriptionService.resume(id, user.sub);
  }
}
