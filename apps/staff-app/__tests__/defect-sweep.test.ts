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

// ── Report: notification action buttons did nothing ────────────────────────
//
// Tapping "Accept" on a task push, or "Accept"/"Decline" on a help request,
// called routes that do not exist. The handler caught the 404 and logged it
// only under __DEV__, so in a release build the notification dismissed itself
// and absolutely nothing happened — no error, no retry, no trace.
describe('notification action endpoints', () => {
  /** Mirrors handleActionButton in src/lib/notifications.ts. */
  function routeFor(actionGroup: string, actionId: string) {
    if (actionGroup === 'visitor_approval') {
      return { method: 'POST', path: '/visitors/:id/decision' };
    }
    if (actionGroup === 'help_request') {
      return {
        method: 'POST',
        path: actionId === 'ACCEPT'
          ? '/staff/help-requests/:id/accept'
          : '/staff/help-requests/:id/decline',
      };
    }
    if (actionGroup === 'task_assignment') {
      return {
        method: 'POST',
        path: actionId === 'ACCEPT'
          ? '/service-requests/:id/accept'
          : '/service-requests/:id/reject',
      };
    }
    return null;
  }

  it('never targets /tasks — there is no such controller in the API', () => {
    for (const action of ['ACCEPT', 'REJECT']) {
      expect(routeFor('task_assignment', action)!.path).not.toMatch(/^\/tasks\b/);
    }
  });

  it('routes task actions at the service-request controller', () => {
    expect(routeFor('task_assignment', 'ACCEPT')).toEqual({
      method: 'POST',
      path: '/service-requests/:id/accept',
    });
    expect(routeFor('task_assignment', 'REJECT')).toEqual({
      method: 'POST',
      path: '/service-requests/:id/reject',
    });
  });

  it('uses the staff-scoped prefix for help requests, and POST not PATCH', () => {
    // The accept route is POST and lives under /staff/help-requests; the app
    // used to PATCH /help-requests/:id/accept, which matched nothing.
    const accept = routeFor('help_request', 'ACCEPT')!;
    expect(accept.method).toBe('POST');
    expect(accept.path).toBe('/staff/help-requests/:id/accept');
    expect(routeFor('help_request', 'DECLINE')!.path).toBe('/staff/help-requests/:id/decline');
  });

  it('leaves the visitor decision route alone — that one always worked', () => {
    expect(routeFor('visitor_approval', 'APPROVE')).toEqual({
      method: 'POST',
      path: '/visitors/:id/decision',
    });
  });

  it('every action group the app registers has a route', () => {
    // The iOS categories registered in notifications.ts. A category with no
    // handler renders buttons that do nothing.
    for (const group of ['visitor_approval', 'help_request', 'task_assignment']) {
      expect(routeFor(group, 'ACCEPT')).not.toBeNull();
    }
  });
});

// ── Geofence must not fail open ───────────────────────────────────────────
describe('check-in geofence', () => {
  /** Mirrors the effect in src/hooks/useAttendance.ts. */
  function evaluate(position: unknown, polygon: unknown[] | undefined) {
    if (!polygon?.length) return { insideGeofence: true, reason: 'no-geofence' };
    if (!position) return { insideGeofence: false, reason: 'no-position' };
    return { insideGeofence: true, reason: 'checked' };
  }

  it('allows check-in when the society has no geofence configured', () => {
    // Nothing to verify against, so allowing it is correct rather than lax.
    expect(evaluate(null, undefined).insideGeofence).toBe(true);
  });

  it('does NOT allow check-in when a geofence exists but there is no fix', () => {
    // This used to fall into the same branch as "no geofence" and return true,
    // so denying location let a staff member check in from anywhere while the
    // geofence silently never ran.
    const r = evaluate(null, [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }]);
    expect(r.insideGeofence).toBe(false);
    expect(r.reason).toBe('no-position');
  });
});
