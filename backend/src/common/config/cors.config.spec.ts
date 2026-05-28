import { buildCorsOptions, originMatchesPattern } from './cors.config';

describe('originMatchesPattern', () => {
  describe('exact match', () => {
    it('matches identical origin', () => {
      expect(
        originMatchesPattern(
          'https://society-admin-dev.marzitech.in',
          'https://society-admin-dev.marzitech.in',
        ),
      ).toBe(true);
    });
    it('rejects different host', () => {
      expect(
        originMatchesPattern('https://evil.com', 'https://society-admin-dev.marzitech.in'),
      ).toBe(false);
    });
    it('rejects scheme mismatch on exact pattern', () => {
      expect(
        originMatchesPattern(
          'http://society-admin-dev.marzitech.in',
          'https://society-admin-dev.marzitech.in',
        ),
      ).toBe(false);
    });
  });

  describe('wildcard suffix — bare "*.marzitech.in"', () => {
    const pattern = '*.marzitech.in';

    it('accepts a single-label subdomain over https', () => {
      expect(originMatchesPattern('https://app.marzitech.in', pattern)).toBe(true);
    });
    it('accepts a hyphenated single-label subdomain', () => {
      expect(originMatchesPattern('https://society-admin-dev.marzitech.in', pattern)).toBe(true);
    });
    it('rejects http origin (bare pattern is https-only)', () => {
      expect(originMatchesPattern('http://app.marzitech.in', pattern)).toBe(false);
    });
    it('rejects multi-label subdomain (no nested wildcards)', () => {
      expect(originMatchesPattern('https://staging.app.marzitech.in', pattern)).toBe(false);
    });
    it('rejects bare apex (no subdomain)', () => {
      expect(originMatchesPattern('https://marzitech.in', pattern)).toBe(false);
    });
    it('rejects host that merely contains the suffix as substring', () => {
      expect(originMatchesPattern('https://marzitech.in.evil.com', pattern)).toBe(false);
    });
    it('rejects sibling TLD spoof', () => {
      expect(originMatchesPattern('https://app.marzitech.io', pattern)).toBe(false);
    });
    it('rejects origin with a trailing path', () => {
      expect(originMatchesPattern('https://app.marzitech.in/admin', pattern)).toBe(false);
    });
    it('accepts non-standard port (browser sends it in Origin)', () => {
      expect(originMatchesPattern('https://app.marzitech.in:8443', pattern)).toBe(true);
    });
  });

  describe('wildcard suffix — explicit scheme "http://*.example.local"', () => {
    const pattern = 'http://*.example.local';
    it('accepts http when the pattern explicitly opts in', () => {
      expect(originMatchesPattern('http://dev.example.local', pattern)).toBe(true);
    });
    it('still rejects https when scheme is locked to http', () => {
      expect(originMatchesPattern('https://dev.example.local', pattern)).toBe(false);
    });
  });

  describe('non-wildcard pattern', () => {
    it('rejects a wildcard origin against an exact pattern', () => {
      expect(originMatchesPattern('https://app.marzitech.in', 'https://other.marzitech.in')).toBe(
        false,
      );
    });
  });

  describe('malformed patterns', () => {
    it('rejects bare * (would be caught at startup but still safe at match)', () => {
      expect(originMatchesPattern('https://anywhere.com', '*')).toBe(false);
    });
    it('rejects "*x.foo.com" — wildcard must be a whole label', () => {
      expect(originMatchesPattern('https://yx.foo.com', '*x.foo.com')).toBe(false);
    });
    it('rejects empty-suffix wildcard "*."', () => {
      expect(originMatchesPattern('https://x.', '*.')).toBe(false);
    });
  });
});

describe('buildCorsOptions — production safety gates', () => {
  it('throws when CORS_ORIGINS is empty in prod', () => {
    expect(() => buildCorsOptions('', true)).toThrow(/non-empty allowlist/);
  });
  it('throws when bare "*" is in the list in prod', () => {
    expect(() => buildCorsOptions('*', true)).toThrow(/wildcard "\*" rejected/);
  });
  it('throws on wildcard pattern too broad ("*.com")', () => {
    expect(() => buildCorsOptions('*.com', true)).toThrow(/too broad in production/);
  });
  it('throws on TLD-only wildcard ("*.in")', () => {
    expect(() => buildCorsOptions('*.in', true)).toThrow(/too broad in production/);
  });
  it('accepts "*.marzitech.in" in prod (suffix has a dot)', () => {
    expect(() => buildCorsOptions('*.marzitech.in', true)).not.toThrow();
  });
  it('accepts mixed exact + wildcard list in prod', () => {
    expect(() =>
      buildCorsOptions('https://society-admin-dev.marzitech.in,*.marzitech.in', true),
    ).not.toThrow();
  });
  it('dev mode: empty list passes through with origin:true', () => {
    const opts = buildCorsOptions('', false) as any;
    expect(opts.origin).toBe(true);
    expect(opts.credentials).toBe(true);
  });
});

describe('buildCorsOptions — wired origin callback', () => {
  function callOrigin(opts: any, origin: string | undefined): boolean {
    return new Promise<boolean>((resolve, reject) => {
      opts.origin(origin, (err: Error | null, ok: boolean) => {
        if (err) reject(err);
        else resolve(ok);
      });
    }) as unknown as boolean;
  }

  it('approves any subdomain when allowlist contains "*.marzitech.in"', async () => {
    const opts = buildCorsOptions('*.marzitech.in,http://localhost:3001', true) as any;
    await expect(
      new Promise((resolve, reject) =>
        opts.origin('https://society-admin-dev.marzitech.in', (e: any, ok: any) =>
          e ? reject(e) : resolve(ok),
        ),
      ),
    ).resolves.toBe(true);
    await expect(
      new Promise((resolve, reject) =>
        opts.origin('https://reports.marzitech.in', (e: any, ok: any) =>
          e ? reject(e) : resolve(ok),
        ),
      ),
    ).resolves.toBe(true);
  });

  it('rejects unrelated origin even when wildcard is broad', async () => {
    const opts = buildCorsOptions('*.marzitech.in', true) as any;
    await expect(
      new Promise((resolve, reject) =>
        opts.origin('https://evil.com', (e: any, ok: any) =>
          e ? reject(e) : resolve(ok),
        ),
      ),
    ).rejects.toThrow(/CORS: origin .* not allowed/);
    // eslint just doesn't like the unused promise, keep it readable.
    void callOrigin;
  });

  it('approves "no origin" requests (server-to-server / curl)', async () => {
    const opts = buildCorsOptions('*.marzitech.in', true) as any;
    await expect(
      new Promise((resolve, reject) =>
        opts.origin(undefined, (e: any, ok: any) => (e ? reject(e) : resolve(ok))),
      ),
    ).resolves.toBe(true);
  });
});
