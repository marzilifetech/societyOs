import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ResidentService } from './resident.service';
import { OnboardResidentDto, UpdateProfileDto } from './dto/resident.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('residents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('residents')
export class ResidentController {
  constructor(private residentService: ResidentService) {}

  @Get('me')
  @Roles(UserRole.RESIDENT)
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.residentService.getProfile(user.sub);
  }

  @Patch('me')
  @Roles(UserRole.RESIDENT)
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.residentService.updateProfile(user.sub, dto);
  }

  @Post('onboard')
  @Roles(UserRole.RESIDENT)
  onboard(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: OnboardResidentDto,
  ) {
    return this.residentService.onboard(user.sub, societyId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  all(@SocietyId() societyId: string, @CurrentUser() user: JwtPayload) {
    return this.residentService.findBySociety(societyId, user.managedBlocks);
  }

  @Post('documents')
  @Roles(UserRole.RESIDENT)
  uploadDocuments(
    @CurrentUser() user: JwtPayload,
    @Body() body: { idProof: string; addressProof: string },
  ) {
    return this.residentService.uploadDocuments(user.sub, body.idProof, body.addressProof);
  }

  @Get('documents/status')
  @Roles(UserRole.RESIDENT)
  getDocumentsStatus(@CurrentUser() user: JwtPayload) {
    return this.residentService.getDocumentsStatus(user.sub);
  }

  @Patch('me/directory-visibility')
  @Roles(UserRole.RESIDENT)
  setDirectoryVisibility(
    @CurrentUser() user: JwtPayload,
    @Body('visible') visible: boolean,
  ) {
    return this.residentService.setDirectoryVisibility(user.sub, visible);
  }
}
