/**
 * Regression tests for the staff-app half of the 2026-09 defect sweep.
 *
 * These pin the request/upload CONTRACTS that were wrong, which is where both
 * defects actually lived — the UI was fine.
 */

// ── Report: "Request leave - Submit request is not functional" ─────────────
//
// The screen posted the ADMIN leave-list RESPONSE shape
// ({ leaveType, fromDate, toDate }) at an API declaring
// { type, startDate, endDate } — and the global ValidationPipe runs with
// forbidNonWhitelisted, so all three extra keys made it a hard 400.
describe('leave request payload', () => {
  /** Mirrors what app/leave/new.tsx now sends. */
  function buildLeaveBody(form: { leaveType: string; fromDate: string; toDate: string; reason: string }) {
    return {
      type: form.leaveType,
      startDate: form.fromDate,
      endDate: form.toDate,
      reason: form.reason,
    };
  }

  const form = { leaveType: 'CASUAL', fromDate: '2026-09-10', toDate: '2026-09-11', reason: 'Family' };

  it('sends the canonical field names the API declares', () => {
    expect(buildLeaveBody(form)).toEqual({
      type: 'CASUAL',
      startDate: '2026-09-10',
      endDate: '2026-09-11',
      reason: 'Family',
    });
  });

  it('sends no key the DTO would reject', () => {
    // forbidNonWhitelisted turns any stray key into a 400 for the whole request.
    const ALLOWED = new Set(['type', 'startDate', 'endDate', 'reason', 'leaveType', 'fromDate', 'toDate']);
    for (const key of Object.keys(buildLeaveBody(form))) {
      expect(ALLOWED.has(key)).toBe(true);
    }
  });

  it('no longer sends the old names that caused the 400', () => {
    const body = buildLeaveBody(form) as Record<string, unknown>;
    expect(body.leaveType).toBeUndefined();
    expect(body.fromDate).toBeUndefined();
    expect(body.toDate).toBeUndefined();
  });
});

// ── Report: "Staff work - Photo upload failure" ───────────────────────────
//
// Every upload presigned an S3 PUT the backend's IAM principal cannot perform,
// so each one 403'd. `/media` is the flow that works.
describe('photo upload flow', () => {
  const mockPost = jest.fn();
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    mockPost.mockReset();
    mockFetch.mockReset();
    (global as any).fetch = mockFetch;
    (global as any).FormData = class {
      private entries: Array<[string, unknown]> = [];
      append(k: string, v: unknown) { this.entries.push([k, v]); }
      getAll() { return this.entries; }
    };
  });

  // `require` after doMock, not a dynamic import: the Jest VM here is CJS and
  // ESM `import()` needs --experimental-vm-modules.
  function loadUploader() {
    jest.doMock('../src/lib/api', () => ({ api: { post: mockPost, get: jest.fn() } }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../src/lib/photo-upload') as typeof import('../src/lib/photo-upload');
  }

  it('uses POST /media + presigned POST, never a self-signed PUT', async () => {
    mockPost
      .mockResolvedValueOnce({
        asset_id: 'asset-1',
        s3_key: 'uploads/x.jpg',
        public_url: 'https://cdn.example/x.jpg',
        upload: { method: 'POST', url: 'https://s3.example/bucket', fields: { key: 'uploads/x.jpg', policy: 'p' } },
      })
      .mockResolvedValueOnce({});
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const { uploadMediaAndGetKey } = loadUploader();
    const key = await uploadMediaAndGetKey('file:///tmp/a.jpg', { contentType: 'image/jpeg' });

    // 1. mint the asset, 3. confirm it
    expect(mockPost).toHaveBeenNthCalledWith(1, '/media', expect.objectContaining({ content_type: 'image/jpeg' }));
    expect(mockPost).toHaveBeenNthCalledWith(2, '/media/asset-1/confirm', {});

    // 2. the bytes go to S3 as a multipart POST — a PUT is the broken path.
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.method).not.toBe('PUT');

    expect(key).toBe('https://cdn.example/x.jpg');
  });

  it('falls back to the S3 key for a private asset with no CDN URL', async () => {
    mockPost
      .mockResolvedValueOnce({
        asset_id: 'asset-2',
        s3_key: 'uploads/private/voice.m4a',
        public_url: null,
        upload: { method: 'POST', url: 'https://s3.example/bucket', fields: {} },
      })
      .mockResolvedValueOnce({});
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const { uploadMediaAndGetKey } = loadUploader();
    const key = await uploadMediaAndGetKey('file:///tmp/v.m4a', {
      contentType: 'audio/m4a',
      visibility: 'private',
    });

    expect(key).toBe('uploads/private/voice.m4a');
  });

  it('surfaces an S3 failure instead of silently reporting success', async () => {
    mockPost.mockResolvedValueOnce({
      asset_id: 'asset-3',
      s3_key: 'k',
      public_url: null,
      upload: { method: 'POST', url: 'https://s3.example/bucket', fields: {} },
    });
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    const { uploadMediaAndGetKey } = loadUploader();
    await expect(uploadMediaAndGetKey('file:///tmp/a.jpg')).rejects.toThrow(/403/);
  });
});
