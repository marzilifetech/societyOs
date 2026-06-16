import { ConfigService } from '@nestjs/config';
import { MarziMediaSigner } from './marzi-media-signer.service';

// Stub the AWS SDK so we never hit the network. getSignedUrl is the only
// touchpoint we care about — its return value is a string the service
// returns verbatim, so we can substitute a sentinel.
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ /* opaque client */ })),
  GetObjectCommand: jest.fn().mockImplementation((args) => ({ args })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

describe('MarziMediaSigner', () => {
  let service: MarziMediaSigner;

  beforeEach(() => {
    (getSignedUrl as jest.Mock).mockReset();
    const config = new ConfigService();
    // Override get() to return our test values.
    jest.spyOn(config, 'get').mockImplementation((key: string) => {
      if (key === 'MARZI_MEDIA_BUCKET') return 'test-bucket';
      if (key === 'AWS_REGION') return 'ap-south-1';
      return undefined;
    });
    service = new MarziMediaSigner(config);
  });

  describe('isS3Key', () => {
    it('treats raw paths as keys', () => {
      expect(service.isS3Key('uploads/private/abc.jpg')).toBe(true);
      expect(service.isS3Key('a/b/c')).toBe(true);
    });

    it('treats http(s) URLs as already-signed and returns false', () => {
      expect(service.isS3Key('http://example.com/x.jpg')).toBe(false);
      expect(service.isS3Key('https://cdn.example.com/x.jpg')).toBe(false);
    });

    it('handles null / undefined / empty string', () => {
      expect(service.isS3Key(null)).toBe(false);
      expect(service.isS3Key(undefined)).toBe(false);
      expect(service.isS3Key('')).toBe(false);
    });
  });

  describe('sign — happy path', () => {
    it('returns the presigned URL for an S3 key', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValueOnce('https://signed.example/abc');
      const url = await service.sign('uploads/private/abc.jpg');
      expect(url).toBe('https://signed.example/abc');
    });

    it('passes through an already-http URL unchanged', async () => {
      const original = 'https://public.cdn/avatar.jpg';
      const url = await service.sign(original);
      expect(url).toBe(original);
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('returns null for falsy input', async () => {
      expect(await service.sign(null)).toBeNull();
      expect(await service.sign(undefined)).toBeNull();
      expect(await service.sign('')).toBeNull();
      expect(getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('sign — failure handling', () => {
    it('returns null and does NOT throw when getSignedUrl rejects', async () => {
      (getSignedUrl as jest.Mock).mockRejectedValueOnce(new Error('access denied'));
      const url = await service.sign('uploads/private/abc.jpg');
      expect(url).toBeNull();
    });
  });

  describe('signMany', () => {
    it('signs every entry in parallel and returns the same shape', async () => {
      (getSignedUrl as jest.Mock).mockImplementation(async (_c, cmd: any) => {
        return `https://signed/${cmd.args.Key}`;
      });
      const input = {
        aadhaar: 'uploads/private/aadhaar.jpg',
        pan: 'uploads/private/pan.jpg',
        addressProof: null,
        idProof: 'https://already-public/id.jpg',
      } as const;
      const result = await service.signMany(input);
      expect(result.aadhaar).toBe('https://signed/uploads/private/aadhaar.jpg');
      expect(result.pan).toBe('https://signed/uploads/private/pan.jpg');
      expect(result.addressProof).toBeNull();
      // http(s) passes through.
      expect(result.idProof).toBe('https://already-public/id.jpg');
    });

    it('returns null for individual failures, never throws', async () => {
      (getSignedUrl as jest.Mock).mockRejectedValueOnce(new Error('one failed'));
      (getSignedUrl as jest.Mock).mockResolvedValueOnce('https://signed/ok');
      const result = await service.signMany({
        a: 'uploads/private/fails.jpg',
        b: 'uploads/private/works.jpg',
      });
      expect(result.a).toBeNull();
      expect(result.b).toBe('https://signed/ok');
    });
  });
});
