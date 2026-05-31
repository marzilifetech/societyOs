import {
  Controller,
  Post,
  Body,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { MarziMediaClient, MediaVisibility } from './marzi-media.client';

// Content types Marzi's media service accepts (mirrors its UNSUPPORTED_CONTENT_TYPE
// list — kept here so we reject early with a clear message instead of a 400 round-trip).
const ALLOWED_CONTENT_TYPES = new Set([
  'image/webp',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

/**
 * Thin proxy in front of the external Marzi media service. The app calls these
 * routes (with its LOCAL bearer); the backend authenticates to Marzi with the
 * user's parked Marzi access token. See {@link MarziMediaClient}.
 *
 * Flow the client drives:
 *   1. POST /media  → { asset_id, s3_key, public_url, upload }
 *   2. upload the file straight to S3 using `upload` (presigned POST)
 *   3. POST /media/:assetId/confirm  → asset becomes ACTIVE
 */
@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly media: MarziMediaClient) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { filename?: string; content_type?: string; visibility?: MediaVisibility },
  ) {
    const filename = body.filename?.trim();
    const contentType = body.content_type?.trim();
    const visibility: MediaVisibility = body.visibility === 'private' ? 'private' : 'public';

    if (!filename) {
      throw new BadRequestException({ code: 'INVALID_FILENAME', message: 'filename is required' });
    }
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: `content_type must be one of: ${[...ALLOWED_CONTENT_TYPES].join(', ')}`,
      });
    }

    return this.media.createMedia(user.sub, {
      filename,
      content_type: contentType,
      visibility,
    });
  }

  @Post(':assetId/confirm')
  async confirm(@CurrentUser() user: JwtPayload, @Param('assetId') assetId: string) {
    return this.media.confirmMedia(user.sub, assetId);
  }
}
