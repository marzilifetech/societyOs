import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * EncryptionService — AES-256-GCM helper for column-level encryption.
 *
 * Key sourced from `ENCRYPTION_KEY` env (base64-encoded 32 bytes). In dev
 * a deterministic placeholder is generated and a warning logged.
 *
 * Wire format (Buffer): [ 12-byte IV || 16-byte AuthTag || ciphertext ].
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.ENCRYPTION_KEY;
    if (raw) {
      const buf = Buffer.from(raw, 'base64');
      if (buf.length !== 32) {
        throw new InternalServerErrorException(
          'ENCRYPTION_KEY must be 32 bytes (base64-encoded)',
        );
      }
      this.key = buf;
    } else {
      this.logger.warn('ENCRYPTION_KEY not set — using insecure dev key');
      this.key = crypto.createHash('sha256').update('dev-encryption-key').digest();
    }
  }

  encrypt(plain: string | null | undefined): Buffer | null {
    if (plain == null || plain === '') return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
  }

  decrypt(blob: Buffer | Uint8Array | null | undefined): string | null {
    if (!blob || blob.length < 28) return null;
    const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return out.toString('utf8');
  }
}
