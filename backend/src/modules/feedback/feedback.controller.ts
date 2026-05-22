import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  @Roles(UserRole.RESIDENT)
  submitFeedback(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: { category?: string; message: string; isAnonymous?: boolean; rating?: number },
  ) {
    return this.feedbackService.submitFeedback(user.sub, societyId, dto);
  }

  @Get('my')
  @Roles(UserRole.RESIDENT)
  getMyFeedback(@CurrentUser() user: JwtPayload) {
    return this.feedbackService.getMyFeedback(user.sub);
  }

  @Get('/admin/feedback')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAll(@SocietyId() societyId: string, @Query('status') status?: string) {
    return this.feedbackService.getAll(societyId, status);
  }

  @Patch('/admin/feedback/:id/review')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  markReviewed(@Param('id') id: string, @Body('adminReply') adminReply?: string) {
    return this.feedbackService.markReviewed(id, adminReply);
  }

  @Patch('/admin/feedback/:id/resolve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  resolve(@Param('id') id: string, @Body('adminReply') adminReply?: string) {
    return this.feedbackService.resolve(id, adminReply);
  }
}
