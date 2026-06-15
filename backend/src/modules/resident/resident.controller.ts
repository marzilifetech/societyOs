import { BadRequestException, Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
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

  @Get('birthdays')
  @Roles(UserRole.RESIDENT)
  getBirthdays(@SocietyId() societyId: string) {
    return this.residentService.getBirthdays(societyId);
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
    @Body()
    body: {
      // Legacy field names — still accepted by clients that haven't upgraded
      idProof?: string;
      addressProof?: string;
      // New presign-upload fields
      aadhaarUrl?: string;
      aadhaarNumber?: string;
      panUrl?: string;
      panNumber?: string;
      idProofUrl?: string;
      addressProofUrl?: string;
    },
  ) {
    const aadhaarNumber = body.aadhaarNumber?.trim();
    const panNumber = body.panNumber?.trim().toUpperCase();
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      throw new BadRequestException({
        code: 'INVALID_AADHAAR',
        message: 'Aadhaar must be exactly 12 digits',
      });
    }
    if (panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber)) {
      throw new BadRequestException({
        code: 'INVALID_PAN',
        message: 'PAN must be in the format ABCDE1234F',
      });
    }

    // Reject URLs that aren't from our configured S3 bucket (defence in depth
    // — the presign endpoint is the only legitimate source of upload URLs).
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
    const isAllowedUrl = (url?: string) => {
      if (!url) return true;
      if (url.startsWith('s3://')) return true;
      if (bucket && url.includes(bucket)) return true;
      // Marzi media service stores assets in its own S3 bucket; document
      // upload now flows through POST /v1/media, so accept those too — both the
      // public CDN URL and the bare private S3 key (uploads/private/...).
      if (url.includes('marzi-community-storage')) return true;
      if (url.startsWith('uploads/private/') || url.startsWith('uploads/public/')) return true;
      return false;
    };
    const urls = [body.aadhaarUrl, body.panUrl, body.idProofUrl, body.addressProofUrl, body.idProof, body.addressProof];
    for (const u of urls) {
      if (u && !isAllowedUrl(u)) {
        throw new BadRequestException({
          code: 'INVALID_UPLOAD_URL',
          message: 'Document URL must come from the presign-upload endpoint',
        });
      }
    }

    return this.residentService.uploadDocuments(user.sub, {
      aadhaarUrl: body.aadhaarUrl,
      aadhaarNumber,
      panUrl: body.panUrl,
      panNumber,
      idProofUrl: body.idProofUrl ?? body.idProof,
      addressProofUrl: body.addressProofUrl ?? body.addressProof,
    });
  }

  @Get('documents/status')
  @Roles(UserRole.RESIDENT)
  getDocumentsStatus(@CurrentUser() user: JwtPayload) {
    return this.residentService.getDocumentsStatus(user.sub);
  }

  @Get('documents/me')
  @Roles(UserRole.RESIDENT)
  getMyDocuments(@CurrentUser() user: JwtPayload) {
    return this.residentService.getMyDocuments(user.sub);
  }

  @Get('society/emergency-contacts')
  @Roles(UserRole.RESIDENT)
  getEmergencyContacts(@SocietyId() societyId: string) {
    return this.residentService.getEmergencyContacts(societyId);
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
