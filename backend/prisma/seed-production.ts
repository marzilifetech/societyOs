/**
 * PRODUCTION seed — creates EXACTLY ONE root Super Admin and the internal
 * "Platform" society that hosts them. Nothing else: no demo societies, no
 * residents, staff, visitors, bills or fixtures.
 *
 * This is intended to be run ONCE against a FRESH/EMPTY production database
 * (e.g. right after `prisma migrate reset --force --skip-seed`, which drops all
 * data and re-applies migrations to an empty schema).
 *
 * The root admin's identity comes from environment variables so no personal
 * number is committed to the repo:
 *
 *   ROOT_ADMIN_PHONE   (required)  e.g. 9812345678   — the login number (OTP)
 *   ROOT_ADMIN_NAME    (optional)  default "Root Admin"
 *   ROOT_ADMIN_EMAIL   (optional)  default "admin@societyos.app"
 *
 * Run:
 *   ROOT_ADMIN_PHONE=98XXXXXXXX ROOT_ADMIN_NAME="Your Name" \
 *   ROOT_ADMIN_EMAIL="you@domain.com" npx ts-node prisma/seed-production.ts
 *
 * Idempotent: re-running upserts the same root admin (safe to run twice).
 */
import { PrismaClient } from '@prisma/client';
import { normalizeIndianPhone } from '../src/common/utils/phone';

const prisma = new PrismaClient();

// Stable id so re-runs target the same platform society.
const PLATFORM_SOCIETY_ID = '00000000-0000-4000-a000-000000000001';

async function main(): Promise<void> {
  const rawPhone = process.env.ROOT_ADMIN_PHONE;
  if (!rawPhone) {
    throw new Error(
      'ROOT_ADMIN_PHONE is required. Example:\n' +
        '  ROOT_ADMIN_PHONE=98XXXXXXXX npx ts-node prisma/seed-production.ts',
    );
  }
  const phone = normalizeIndianPhone(rawPhone);
  const name = process.env.ROOT_ADMIN_NAME || 'Root Admin';
  const email = process.env.ROOT_ADMIN_EMAIL || 'admin@societyos.app';

  // Safety: refuse to run if the DB clearly still has data (unless FORCE set).
  // A production seed is meant for an empty DB; this guards against wiping a
  // populated database by accident.
  const [societyCount, userCount] = await Promise.all([
    prisma.society.count(),
    prisma.user.count(),
  ]);
  const nonPlatformSocieties = await prisma.society.count({
    where: { id: { not: PLATFORM_SOCIETY_ID } },
  });
  if ((societyCount > 1 || userCount > 1 || nonPlatformSocieties > 0) && !process.env.FORCE) {
    throw new Error(
      `Refusing to run: database is not empty (societies=${societyCount}, users=${userCount}). ` +
        `This script is for a FRESH production DB. If you have already reset the DB and still ` +
        `see this, set FORCE=1 to proceed.`,
    );
  }

  await prisma.society.upsert({
    where: { id: PLATFORM_SOCIETY_ID } as any,
    update: { status: 'ACTIVE' },
    create: {
      id: PLATFORM_SOCIETY_ID,
      name: 'SocietyOS Platform',
      address: 'Internal',
      city: '—',
      pincode: '000000',
      shortCode: 'MZ-PLAT',
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.upsert({
    where: { phone_societyId: { phone, societyId: PLATFORM_SOCIETY_ID } },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE', name, email },
    create: {
      phone,
      name,
      email,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      societyId: PLATFORM_SOCIETY_ID,
    },
  });

  console.log('✅ Production seed complete.');
  console.log(`   Root Super Admin: ${admin.name} <${admin.email}>  phone=${admin.phone}`);
  console.log('   Log in with this phone number; OTP is delivered by SMS (OTP_PROVIDER=marzi).');
}

main()
  .catch((e) => {
    console.error('❌ Production seed failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
