/**
 * APP REVIEW seed — a self-contained demo society so Apple's (or Google's)
 * reviewer can sign in to the resident app on PRODUCTION.
 *
 * The resident app is OTP-only. 9999999001 is already a hardcoded test number
 * in auth.service.ts (TEST_OTP_NUMBERS): it never receives an SMS and accepts
 * only OTP 0000. This script makes that number an ACTIVE resident of a demo
 * society, with enough data that no screen the reviewer opens is empty:
 *
 *   Society   Marzi Demo Residency (App Review) — Bengaluru
 *   Resident  9999999001 / OTP 0000 — "App Reviewer", flat A-101
 *   Data      notices, events, a poll, maintenance bills, 21 days of canteen
 *             menus, visitor history, one visitor waiting at the gate, and a
 *             service request in progress.
 *
 * Safety:
 *   - Touches ONLY rows in the demo society (fixed ids below). It never reads
 *     or modifies another society's data.
 *   - The society has no staff or admins, so an SOS raised by the reviewer
 *     alerts nobody real (SOS fans out to the raising society only).
 *   - It is listed in the pre-login society directory, because the reviewer
 *     must pick it. Real residents will see it there too; hide it after
 *     approval with the super-admin "Show in directory" toggle, and turn it
 *     back on for each future review.
 *
 * Run (prints the target database host and does nothing without the confirm):
 *   APP_REVIEW_CONFIRM=yes npx ts-node prisma/seed-app-review.ts
 *
 * Idempotent: safe to re-run. Re-running before a new review refreshes the
 * canteen menus, bill due dates and event dates so nothing looks stale.
 */
import { PrismaClient } from '@prisma/client';
import { normalizeIndianPhone } from '../src/common/utils/phone';
import { formatIstDate } from '../src/common/utils/ist-time.util';

const prisma = new PrismaClient();

const SOCIETY_ID = 'a9900000-0000-4000-a000-000000000001';
const FLAT_ID = 'a9900000-0000-4000-a000-000000000002';
const REVIEWER_PHONE = '9999999001';

// Fixed ids so re-runs update instead of duplicating.
const id = (n: number) => `a9900000-0000-4000-a000-${String(n).padStart(12, '0')}`;

const DAY = 24 * 60 * 60 * 1000;
const fromNow = (ms: number) => new Date(Date.now() + ms);
/** Midnight UTC of the IST calendar day `offset` days from today (a @db.Date). */
const istDay = (offset: number) => {
  const d = new Date(formatIstDate(new Date()));
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

async function main(): Promise<void> {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host || '(unset)';
    } catch {
      return '(unparseable DATABASE_URL)';
    }
  })();
  console.log(`Target database: ${host}`);
  if (process.env.APP_REVIEW_CONFIRM !== 'yes') {
    console.log('Nothing written. Re-run with APP_REVIEW_CONFIRM=yes to apply.');
    return;
  }

  const society = await prisma.society.upsert({
    where: { id: SOCIETY_ID },
    update: { showInDirectory: true },
    create: {
      id: SOCIETY_ID,
      name: 'Marzi Demo Residency (App Review)',
      address: '1 Demo Avenue, Indiranagar',
      city: 'Bengaluru',
      pincode: '560038',
      showInDirectory: true,
    },
  });

  const flat = await prisma.flat.upsert({
    where: { id: FLAT_ID },
    update: {},
    create: { id: FLAT_ID, societyId: society.id, block: 'A', floor: 1, number: '101', areaSqft: 1150 },
  });

  const phone = normalizeIndianPhone(REVIEWER_PHONE);
  const user = await prisma.user.upsert({
    where: { phone_societyId: { phone, societyId: society.id } },
    update: { status: 'ACTIVE', role: 'RESIDENT' },
    create: { phone, name: 'App Reviewer', role: 'RESIDENT', status: 'ACTIVE', societyId: society.id },
  });

  const resident = await prisma.resident.upsert({
    where: { userId: user.id },
    update: { flatId: flat.id, documentsStatus: 'VERIFIED' },
    create: {
      userId: user.id,
      flatId: flat.id,
      type: 'OWNER',
      moveInDate: new Date('2024-06-01'),
      documentsStatus: 'VERIFIED',
    },
  });

  // ─── Notices ────────────────────────────────────────────────────────────
  const notices = [
    { n: 10, title: 'Water Supply Interruption', category: 'MAINTENANCE', isPinned: true, ago: 2 * 60 * 60 * 1000,
      body: 'Water supply will be interrupted on Saturday from 10am to 2pm for overhead tank cleaning.' },
    { n: 11, title: 'Lift Maintenance – Block B', category: 'MAINTENANCE', isPinned: false, ago: 6 * 60 * 60 * 1000,
      body: 'Lift 2 in Block B will be under scheduled maintenance on Tuesday from 11am to 1pm. Please use Lift 1.' },
    { n: 12, title: 'Yoga in the Garden', category: 'EVENT', isPinned: false, ago: 1 * DAY,
      body: 'Free morning yoga every Saturday and Sunday at 6:30am on the central lawn. All residents welcome.' },
    { n: 13, title: 'Visitor Parking Reminder', category: 'GENERAL', isPinned: false, ago: 3 * DAY,
      body: 'Visitor vehicles must be parked in the marked bays near Gate 2. Please share this with your guests.' },
  ];
  for (const x of notices) {
    const data = {
      societyId: society.id, title: x.title, body: x.body, category: x.category, isPinned: x.isPinned,
      publishedAt: fromNow(-x.ago), createdAt: fromNow(-x.ago), expiresAt: fromNow(30 * DAY),
    };
    await prisma.notice.upsert({ where: { id: id(x.n) }, update: data, create: { id: id(x.n), ...data } });
  }

  // ─── Events ─────────────────────────────────────────────────────────────
  const events = [
    { n: 20, title: 'Weekend Yoga Camp', category: 'SPORTS', days: 4, venue: 'Terrace Garden', capacity: 30,
      description: 'Start your weekend with energy. All levels welcome — mats provided.' },
    { n: 21, title: 'Kids Painting Workshop', category: 'WORKSHOP', days: 9, venue: 'Community Hall', capacity: 20,
      description: 'A creative painting afternoon for children aged 5 to 12.' },
  ];
  for (const x of events) {
    const data = {
      societyId: society.id, title: x.title, description: x.description, category: x.category,
      date: fromNow(x.days * DAY), venue: x.venue, capacity: x.capacity, status: 'PUBLISHED' as const,
    };
    await prisma.event.upsert({ where: { id: id(x.n) }, update: data, create: { id: id(x.n), ...data } });
  }

  // ─── Poll ───────────────────────────────────────────────────────────────
  const poll = {
    societyId: society.id,
    question: 'Which day works best for the community clean-up drive?',
    options: ['Saturday morning', 'Sunday morning', 'Sunday evening'],
    deadline: fromNow(10 * DAY),
    isAnonymous: false,
  };
  await prisma.poll.upsert({ where: { id: id(30) }, update: poll, create: { id: id(30), ...poll } });

  // ─── Maintenance bills: last month paid, this month due ──────────────────
  const period = (offsetMonths: number) => {
    const d = istDay(0);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + offsetMonths);
    return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, due: new Date(d.getTime() + 9 * DAY) };
  };
  const breakdown = { maintenance: 3600, water: 500, parking: 400 };
  const bills = [
    { n: 40, p: period(-1), status: 'SUCCESS' as const },
    { n: 41, p: period(0), status: 'PENDING' as const },
  ];
  for (const b of bills) {
    // The current bill's due date is kept in the future so it never shows as overdue during review.
    const due = b.status === 'PENDING' && b.p.due < new Date() ? fromNow(10 * DAY) : b.p.due;
    const data = {
      flatId: flat.id, residentId: resident.id, period: b.p.key, breakdown, total: 4500, dueDate: due, status: b.status,
    };
    await prisma.maintenanceBill.upsert({ where: { id: id(b.n) }, update: data, create: { id: id(b.n), ...data } });
  }

  // ─── Canteen: breakfast + lunch for the next 21 days ─────────────────────
  const dishes: Record<string, { name: string; calories: number; price: number; allergens?: string[] }[]> = {
    BREAKFAST: [
      { name: 'Idli Sambar', calories: 250, price: 50 },
      { name: 'Masala Dosa', calories: 390, price: 65 },
      { name: 'Vegetable Poha', calories: 280, price: 45 },
      { name: 'Masala Chai', calories: 90, price: 20, allergens: ['Milk'] },
    ],
    LUNCH: [
      { name: 'Veg Thali', calories: 650, price: 120 },
      { name: 'Dal Khichdi', calories: 430, price: 70 },
      { name: 'Curd Rice', calories: 320, price: 60, allergens: ['Milk'] },
    ],
  };
  for (let day = 0; day < 21; day++) {
    for (const mealType of Object.keys(dishes)) {
      const menu = await prisma.canteenMenu.upsert({
        where: { societyId_date_mealType: { societyId: society.id, date: istDay(day), mealType } },
        update: {},
        create: { societyId: society.id, date: istDay(day), mealType },
      });
      const existing = await prisma.canteenDish.count({ where: { menuId: menu.id } });
      if (existing === 0) {
        await prisma.canteenDish.createMany({
          data: dishes[mealType].map((d) => ({
            menuId: menu.id, name: d.name, calories: d.calories, price: d.price,
            allergens: d.allergens ?? [], isVeg: true, isAvailable: true,
          })),
        });
      }
    }
  }

  // ─── Visitors: history, an expected guest, and one waiting at the gate ───
  const visitors = [
    { n: 50, name: 'Courier Delivery', phone: '+910000000051', purpose: 'Package delivery', status: 'CHECKED_OUT' as const,
      approvalStatus: 'APPROVED', entry: -26 * 60 * 60 * 1000, exit: -25.5 * 60 * 60 * 1000 },
    { n: 51, name: 'Guest – Family Visit', phone: '+910000000052', purpose: 'Family visit', status: 'EXPECTED' as const,
      approvalStatus: 'APPROVED' },
    // Shows the approve / reject card on launch — the app's core feature.
    { n: 52, name: 'Demo Visitor at Gate', phone: '+910000000053', purpose: 'Guest', status: 'EXPECTED' as const,
      approvalStatus: 'PENDING' },
  ];
  for (const v of visitors) {
    const data = {
      residentId: resident.id, name: v.name, phone: v.phone, purpose: v.purpose, status: v.status,
      approvalStatus: v.approvalStatus, qrToken: id(v.n),
      validFrom: fromNow(-DAY * 2), validUntil: fromNow(DAY * 14),
      entryAt: v.entry !== undefined ? fromNow(v.entry) : null,
      exitAt: v.exit !== undefined ? fromNow(v.exit) : null,
    };
    await prisma.visitor.upsert({ where: { id: id(v.n) }, update: data, create: { id: id(v.n), ...data } });
  }

  // ─── A service request in progress ──────────────────────────────────────
  const request = {
    societyId: society.id, residentId: resident.id, category: 'PLUMBING',
    description: 'Kitchen sink tap is dripping continuously.', status: 'IN_PROGRESS' as const,
    slaDeadline: fromNow(DAY), acceptedAt: fromNow(-2 * 60 * 60 * 1000), createdAt: fromNow(-5 * 60 * 60 * 1000),
  };
  await prisma.serviceRequest.upsert({ where: { id: id(60) }, update: request, create: { id: id(60), ...request } });

  console.log(`Ready: "${society.name}" — sign in with ${REVIEWER_PHONE}, OTP 0000.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
