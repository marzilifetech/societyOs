import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentRequestService } from './document-request.service';
import { CreateDocumentRequestDto, RateDocumentRequestDto } from './dto/document-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('document-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('document-requests')
export class DocumentRequestController {
  constructor(private documentRequestService: DocumentRequestService) {}

  @Get('my')
  findMy(@CurrentUser() user: JwtPayload) {
    return this.documentRequestService.findMy(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string, @Body() dto: CreateDocumentRequestDto) {
    return this.documentRequestService.create(user.sub, societyId, dto);
  }

  @Get(':id/download')
  download(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documentRequestService.download(id, user.sub);
  }

  @Post(':id/rating')
  rate(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: RateDocumentRequestDto) {
    return this.documentRequestService.rate(id, user.sub, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documentRequestService.findOne(id, user.sub);
  }

  // Admin endpoints
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAll(@SocietyId() societyId: string) {
    return this.documentRequestService.findAll(societyId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  approve(
    @Param('id') id: string,
    @Body() body: { documentUrl?: string; adminNotes?: string },
  ) {
    return this.documentRequestService.approve(id, body.documentUrl, body.adminNotes);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.documentRequestService.reject(id, reason);
  }
}
