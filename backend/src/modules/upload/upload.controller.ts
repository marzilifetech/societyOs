import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { S3Service } from '../../common/storage/s3.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('upload')
export class UploadController {
  constructor(private s3: S3Service) {}

  @Post('presign')
  async getPresignedUpload(
    @Body() body: { contentType: string; folder: string },
  ) {
    const { contentType, folder } = body;
    const result = await this.s3.getPresignedUploadUrl(`uploads/${folder}`, contentType);
    return {
      url: result.uploadUrl,
      key: result.key,
      publicUrl: result.publicUrl,
    };
  }
}