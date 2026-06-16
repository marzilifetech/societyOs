import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Signs short-lived GET URLs for objects in the Marzi-managed S3 bucket where
 * private uploads land. Marzi's `/v1/media` API only mints upload URLs —
 * downstream consumers (us) sign downloads ourselves with our own AWS creds.
 *
 * Credential resolution follows the AWS SDK default chain:
 *   1. AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (env)
 *   2. shared profile / credentials file
 *   3. IMDS (EC2 / Lightsail instance role)
 *
 * If the resolved IAM principal lacks `s3:GetObject` on the bucket, the
 * presign call still succeeds (it's offline) but the signed URL returns
 * 403/AccessDenied when opened. To grant access:
 *
 *   {
 *     "Effect": "Allow",
 *     "Action": "s3:GetObject",
 *     "Resource": "arn:aws:s3:::marzi-community-storage/uploads/private/*"
 *   }
 */
@Injectable()
export class MarziMediaSigner {
  private readonly logger = new Logger(MarziMediaSigner.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly client: S3Client | null;

  constructor(private readonly config: ConfigService) {
    // Override-able via env so the production bucket can differ (e.g. a
    // marzi-community-prod sibling). Defaults to the dev bucket we observed
    // in the Marzi Postman collection.
    this.bucket =
      this.config.get<string>('MARZI_MEDIA_BUCKET') ??
      'marzi-community-storage';
    this.region = this.config.get<string>('AWS_REGION') ?? 'ap-south-1';

    try {
      // Let SDK v3 pick up credentials from the chain. Passing nothing here
      // is intentional — supplying empty access-key envs would cause the SDK
      // to throw on construction.
      this.client = new S3Client({ region: this.region });
    } catch (err) {
      this.logger.warn(
        `MarziMediaSigner disabled: could not init S3Client (${(err as Error).message})`,
      );
      this.client = null;
    }
  }

  /**
   * Looks like an S3 key (no scheme, no host). Anything starting with
   * http:// or https:// is treated as already-signed and returned as-is so
   * mixed-mode rows (legacy public_url) keep working.
   */
  isS3Key(value: string | null | undefined): boolean {
    if (!value) return false;
    return !/^https?:\/\//i.test(value);
  }

  /**
   * Sign a GET URL with the given expiry (default 15 min). Returns `null`
   * when the signer is disabled or the input isn't an S3 key.
   */
  async sign(s3Key: string | null | undefined, expiresInSeconds = 900): Promise<string | null> {
    if (!s3Key) return null;
    if (!this.isS3Key(s3Key)) return s3Key; // already an http(s) URL
    if (!this.client) return null;
    try {
      const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: s3Key });
      return await getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
    } catch (err) {
      this.logger.warn(
        `Failed to sign GET for key=${s3Key}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Convenience helper for callers that need to sign multiple keys in one go
   * and prefer parallelism over a manual Promise.all dance.
   */
  async signMany<T extends Record<string, string | null | undefined>>(
    keys: T,
    expiresInSeconds = 900,
  ): Promise<{ [K in keyof T]: string | null }> {
    const entries = await Promise.all(
      Object.entries(keys).map(async ([k, v]) => [k, await this.sign(v, expiresInSeconds)] as const),
    );
    return Object.fromEntries(entries) as { [K in keyof T]: string | null };
  }
}
