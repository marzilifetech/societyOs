import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  // Env contract is AWS_S3_BUCKET (env.validation.ts); S3_BUCKET kept as a
  // legacy fallback so any older deploy config still resolves.
  private readonly bucket =
    process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 's3.fake';
  private readonly region = process.env.AWS_REGION || 'ap-south-1';
  private s3Client: S3Client | null = null;
  private isFake = false;

  constructor() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    } else {
      this.logger.warn('AWS credentials not found. S3Service will use fallback mock URLs.');
      this.isFake = true;
    }
  }

  async getPresignedUploadUrl(prefix: string, contentType = 'application/octet-stream'): Promise<PresignedUpload> {
    const ext = this.guessExt(contentType);
    const key = `${prefix.replace(/^\/+|\/+$/g, '')}/${Date.now()}-${randomUUID()}${ext}`;
    
    if (this.isFake || !this.s3Client) {
      return {
        uploadUrl: `https://${this.bucket}/${key}?X-Amz-Signature=fake`,
        key,
        publicUrl: `https://${this.bucket}/${key}`,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    return {
      uploadUrl,
      key,
      publicUrl: this.getPublicUrl(key),
    };
  }

  getPublicUrl(key: string): string {
    if (this.isFake) {
      return `https://${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  getSignedReadUrl(key: string): string {
    return `https://${this.bucket}/${key}?X-Amz-Signature=fake-read`;
  }

  private guessExt(contentType: string): string {
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('pdf')) return '.pdf';
    if (contentType.includes('mp4')) return '.mp4';
    if (contentType.includes('audio')) return '.m4a';
    return '';
  }
}
