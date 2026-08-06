/**
 * Grant SUPER_ADMIN (all rights) to a phone number on the internal Platform
 * society. Unlike seed-production.ts this is SAFE to run against a populated
 * production database — it only upserts the one user you name, touching nothing
 * else. Idempotent: re-running just re-asserts the role/status.
 *
 * The user logs in at the admin panel with this phone; OTP is delivered by SMS
 * (OTP_PROVIDER=marzi). The number does not need to pre-exist anywhere.
 *
 *   ADMIN_PHONE=8826803840 ADMIN_NAME="Ashwin" \
 *   npx ts-node prisma/add-super-admin.ts
 *
 *   ADMIN_EMAIL is optional.
 */
import { PrismaClient } from '@prisma/client';
import { normalizeIndianPhone } from '../src/common/utils/phone';

const prisma = new PrismaClient();

// Must match seed-production.ts — the society every platform SUPER_ADMIN lives in.
const PLATFORM_SOCIETY_ID = '00000000-0000-4000-a000-000000000001';

async function main(): Promise<void> {
  const rawPhone = process.env.ADMIN_PHONE;
  if (!rawPhone) {
    throw new Error(
      'ADMIN_PHONE is required. Example:\n' +
        '  ADMIN_PHONE=8826803840 ADMIN_NAME="Ashwin" npx ts-node prisma/add-super-admin.ts',
    );
  }
  const phone = normalizeIndianPhone(rawPhone);
  const name = process.env.ADMIN_NAME || 'Super Admin';
  const email = process.env.ADMIN_EMAIL || null;

  const platform = await prisma.society.findUnique({ where: { id: PLATFORM_SOCIETY_ID } });
  if (!platform) {
    throw new Error(
      'Platform society not found. Run prisma/seed-production.ts first (this DB has not been ' +
        'initialised for production).',
    );
  }

  const admin = await prisma.user.upsert({
    where: { phone_societyId: { phone, societyId: PLATFORM_SOCIETY_ID } },
    update: {
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      name,
      ...(email ? { email } : {}),
    },
    create: {
      phone,
      name,
      email: email ?? undefined,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      societyId: PLATFORM_SOCIETY_ID,
    },
  });

  console.log('✅ Super admin granted.');
  console.log(
    `   ${admin.name} — phone=${admin.phone} role=${admin.role} status=${admin.status}` +
      (admin.email ? ` <${admin.email}>` : ''),
  );
  console.log('   Log in at the admin panel with this phone; OTP arrives by SMS.');
}

main()
  .catch((e) => {
    console.error('❌ Failed to grant super admin:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
