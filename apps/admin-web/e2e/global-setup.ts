import { chromium, FullConfig, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Logs in via API once and saves storageState so each test reuses the session.
 * In CI without a backend, falls back to writing an empty storageState so
 * tests can still load (but auth-gated tests should be marked .skip).
 */
export default async function globalSetup(_config: FullConfig) {
  const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:3000';
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
  const authDir = path.join(__dirname, '.auth');
  const storagePath = path.join(authDir, 'admin.json');

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  try {
    const ctx = await request.newContext({ baseURL: apiUrl });
    const otpReq = await ctx.post('/v1/auth/otp/request', {
      data: { phone: process.env.E2E_ADMIN_PHONE ?? '+919999000000' },
    });
    if (!otpReq.ok()) throw new Error('otp request failed');
    const verify = await ctx.post('/v1/auth/otp/verify', {
      data: {
        phone: process.env.E2E_ADMIN_PHONE ?? '+919999000000',
        code: process.env.E2E_ADMIN_OTP ?? '123456',
      },
    });
    if (!verify.ok()) throw new Error('otp verify failed');
    const { accessToken } = await verify.json();

    const browser = await chromium.launch();
    const browserCtx = await browser.newContext({ baseURL: baseUrl });
    await browserCtx.addCookies([
      { name: 'access_token', value: accessToken, url: baseUrl, httpOnly: true },
    ]);
    await browserCtx.storageState({ path: storagePath });
    await browser.close();
  } catch {
    // Fallback: empty storage. Tests requiring auth should skip when not
    // populated. This keeps the suite runnable in offline CI.
    fs.writeFileSync(storagePath, JSON.stringify({ cookies: [], origins: [] }));
  }
}
