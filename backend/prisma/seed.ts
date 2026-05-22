import { PrismaClient } from '@prisma/client';
import { normalizeIndianPhone } from '../src/common/utils/phone';

const prisma = new PrismaClient();

async function main() {
  // Society — fixed UUID v4 so API validators accept it
  const SOCIETY_ID = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
  const society = await prisma.society.upsert({
    where: { id: SOCIETY_ID } as any,
    update: {},
    create: {
      id: SOCIETY_ID,
      name: 'Green Valley Heights',
      address: '42 Sector 14, Green Valley',
      city: 'Bengaluru',
      pincode: '560001',
    },
  });

  // Flats
  const flatData = [
    { block: 'A', floor: 1, number: '101' },
    { block: 'A', floor: 1, number: '102' },
    { block: 'A', floor: 2, number: '201' },
    { block: 'B', floor: 1, number: '101' },
    { block: 'B', floor: 2, number: '201' },
  ];

  const flats = await Promise.all(
    flatData.map((f) =>
      prisma.flat.upsert({
        where: { societyId_block_number: { societyId: society.id, block: f.block, number: f.number } },
        update: {},
        create: { ...f, societyId: society.id, areaSqft: 950 },
      }),
    ),
  );

  // Admin user
  await prisma.user.upsert({
    where: { phone_societyId: { phone: normalizeIndianPhone('9000000001'), societyId: society.id } },
    update: {},
    create: {
      phone: normalizeIndianPhone('9000000001'),
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      societyId: society.id,
    },
  });

  // Resident users
  const residentData = [
    { phone: '9100000001', name: 'Rahul Sharma', flatIdx: 0 },
    { phone: '9100000002', name: 'Priya Patel', flatIdx: 1 },
    { phone: '9100000003', name: 'Amit Kumar', flatIdx: 2 },
    { phone: '9100000004', name: 'Sunita Reddy', flatIdx: 3 },
  ];

  for (const r of residentData) {
    const user = await prisma.user.upsert({
      where: { phone_societyId: { phone: normalizeIndianPhone(r.phone), societyId: society.id } },
      update: {},
      create: {
        phone: normalizeIndianPhone(r.phone),
        name: r.name,
        role: 'RESIDENT',
        status: 'ACTIVE',
        societyId: society.id,
      },
    });

    await prisma.resident.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        flatId: flats[r.flatIdx].id,
        type: 'OWNER',
        moveInDate: new Date('2023-01-01'),
      },
    });
  }

  // Staff users
  const staffData = [
    { phone: '9200000001', name: 'Raju Security', designation: 'Security Guard', categories: ['SECURITY'] },
    { phone: '9200000002', name: 'Mohan Cleaner', designation: 'Housekeeping', categories: ['HOUSEKEEPING'] },
    { phone: '9200000003', name: 'Suresh Plumber', designation: 'Maintenance', categories: ['PLUMBING', 'MAINTENANCE'] },
  ];

  for (const s of staffData) {
    const user = await prisma.user.upsert({
      where: { phone_societyId: { phone: normalizeIndianPhone(s.phone), societyId: society.id } },
      update: {},
      create: {
        phone: normalizeIndianPhone(s.phone),
        name: s.name,
        role: 'STAFF',
        status: 'ACTIVE',
        societyId: society.id,
      },
    });

    await prisma.staffMember.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        societyId: society.id,
        designation: s.designation,
        categories: s.categories,
        joiningDate: new Date('2022-06-01'),
      },
    });
  }

  // Notices
  await prisma.notice.createMany({
    skipDuplicates: true,
    data: [
      {
        societyId: society.id,
        title: 'Water Supply Interruption',
        body: 'Water supply will be interrupted on Saturday from 10am to 2pm for tank cleaning.',
        category: 'MAINTENANCE',
        isPinned: true,
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        title: 'Annual General Meeting',
        body: 'The Annual General Meeting will be held on the 15th of next month at 6pm in the community hall.',
        category: 'GENERAL',
        isPinned: false,
        publishedAt: new Date(),
      },
      {
        societyId: society.id,
        title: 'Diwali Celebration',
        body: 'Join us for the Diwali celebration in the garden on November 1st at 7pm.',
        category: 'EVENT',
        isPinned: false,
        publishedAt: new Date(),
      },
    ],
  });

  // Events
  const futureDate = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await prisma.event.createMany({
    skipDuplicates: true,
    data: [
      {
        societyId: society.id,
        title: 'Morning Yoga Camp',
        description: 'Start your day with energy. All skill levels welcome.',
        category: 'SPORTS',
        date: futureDate(3),
        venue: 'Terrace Garden',
        capacity: 30,
        status: 'PUBLISHED',
      },
      {
        societyId: society.id,
        title: 'Kids Painting Workshop',
        description: 'Creative painting workshop for children aged 5-12.',
        category: 'WORKSHOP',
        date: futureDate(7),
        venue: 'Community Hall',
        capacity: 20,
        status: 'PUBLISHED',
      },
    ],
  });

  await prisma.medicalStaff.createMany({
    skipDuplicates: true,
    data: [
      {
        societyId: society.id,
        name: 'Meera Nair',
        designation: 'General Physician',
        schedule: { availableDays: ['Mon', 'Wed', 'Fri'], qualifications: 'MBBS, MD' } as any,
      },
      {
        societyId: society.id,
        name: 'Arjun Rao',
        designation: 'Physiotherapist',
        schedule: { availableDays: ['Tue', 'Thu', 'Sat'], qualifications: 'BPT, MPT' } as any,
      },
    ],
  });

  const rahul = await prisma.resident.findFirstOrThrow({
    where: { user: { phone: normalizeIndianPhone('9100000001'), societyId: society.id } },
    include: { flat: true },
  });

  await prisma.maintenanceBill.createMany({
    skipDuplicates: true,
    data: [
      {
        flatId: rahul.flatId,
        residentId: rahul.id,
        period: '2026-04',
        breakdown: { maintenance: 3200, water: 450, parking: 350 },
        total: 4000,
        dueDate: new Date('2026-04-10'),
        status: 'PENDING',
      },
      {
        flatId: rahul.flatId,
        residentId: rahul.id,
        period: '2026-03',
        breakdown: { maintenance: 3200, water: 450, parking: 350 },
        total: 4000,
        dueDate: new Date('2026-03-10'),
        status: 'SUCCESS',
      },
    ],
  });

  await prisma.poll.createMany({
    skipDuplicates: true,
    data: [
      {
        societyId: society.id,
        question: 'Which day works best for the resident health camp?',
        options: ['Saturday morning', 'Saturday evening', 'Sunday morning'],
        deadline: futureDate(5),
        isAnonymous: false,
      },
    ],
  });

  const canteenDate = new Date();
  canteenDate.setHours(0, 0, 0, 0);
  const tomorrow = new Date(canteenDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const breakfastMenu = await prisma.canteenMenu.upsert({
    where: {
      societyId_date_mealType: {
        societyId: society.id,
        date: canteenDate,
        mealType: 'BREAKFAST',
      },
    },
    update: {},
    create: {
      societyId: society.id,
      date: canteenDate,
      mealType: 'BREAKFAST',
    },
  });

  await prisma.canteenDish.deleteMany({ where: { menuId: breakfastMenu.id } });
  await prisma.canteenDish.createMany({
    data: [
      {
        menuId: breakfastMenu.id,
        name: 'Vegetable Poha',
        allergens: [],
        calories: 280,
        isVeg: true,
        price: 45,
      },
      {
        menuId: breakfastMenu.id,
        name: 'Fruit Bowl',
        allergens: [],
        calories: 160,
        isVeg: true,
        price: 55,
      },
    ],
  });

  const lunchMenu = await prisma.canteenMenu.upsert({
    where: {
      societyId_date_mealType: {
        societyId: society.id,
        date: tomorrow,
        mealType: 'LUNCH',
      },
    },
    update: {},
    create: {
      societyId: society.id,
      date: tomorrow,
      mealType: 'LUNCH',
    },
  });

  await prisma.canteenDish.deleteMany({ where: { menuId: lunchMenu.id } });
  await prisma.canteenDish.createMany({
    data: [
      {
        menuId: lunchMenu.id,
        name: 'Dal Khichdi',
        allergens: [],
        calories: 430,
        isVeg: true,
        price: 70,
      },
      {
        menuId: lunchMenu.id,
        name: 'Curd Rice',
        allergens: ['Milk'],
        calories: 320,
        isVeg: true,
        price: 60,
      },
    ],
  });

  // ─── Pending residents (for Approval workflow testing) ───────────────────────
  const pendingResidentData = [
    { phone: '9100000005', name: 'Anjali Verma', flatIdx: 4 },
    { phone: '9100000006', name: 'Karan Mehra', flatIdx: 0 },
  ];
  for (const r of pendingResidentData) {
    const user = await prisma.user.upsert({
      where: { phone_societyId: { phone: normalizeIndianPhone(r.phone), societyId: society.id } },
      update: {},
      create: {
        phone: normalizeIndianPhone(r.phone),
        name: r.name,
        role: 'RESIDENT',
        status: 'PENDING',
        societyId: society.id,
      },
    });
    await prisma.resident.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        flatId: flats[r.flatIdx].id,
        type: 'TENANT',
        moveInDate: new Date(),
      },
    });
  }

  // ─── More residents map ─────────────────────────────────────────────────────
  const allResidents = await prisma.resident.findMany({
    where: { user: { societyId: society.id, status: 'ACTIVE' } },
    include: { user: true, flat: true },
  });
  const allStaff = await prisma.staffMember.findMany({
    where: { societyId: society.id },
    include: { user: true },
  });
  const rahulRes = allResidents.find((r) => r.user.phone.endsWith('9100000001'))!;
  const priyaRes = allResidents.find((r) => r.user.phone.endsWith('9100000002'))!;
  const amitRes  = allResidents.find((r) => r.user.phone.endsWith('9100000003'))!;
  const sunitaRes = allResidents.find((r) => r.user.phone.endsWith('9100000004'))!;
  const securityStaff = allStaff.find((s) => s.user.phone.endsWith('9200000001'))!;
  const housekeepingStaff = allStaff.find((s) => s.user.phone.endsWith('9200000002'))!;
  const plumberStaff = allStaff.find((s) => s.user.phone.endsWith('9200000003'))!;

  // ─── Visitors ────────────────────────────────────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(8, 0, 0, 0);
  await prisma.visitor.deleteMany({ where: { resident: { user: { societyId: society.id } } } });
  await prisma.visitor.createMany({
    data: [
      {
        residentId: rahulRes.id,
        name: 'Amazon Delivery',
        phone: '+919876543210',
        purpose: 'Package delivery',
        vehicleNo: 'KA01AB1234',
        status: 'CHECKED_IN',
        validFrom: new Date(Date.now() - 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000),
        entryAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        residentId: priyaRes.id,
        name: 'Sangeeta Aunty',
        phone: '+919876500001',
        purpose: 'Family visit',
        status: 'EXPECTED',
        validFrom: new Date(Date.now() - 30 * 60 * 1000),
        validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
      {
        residentId: amitRes.id,
        name: 'Plumbing Service',
        phone: '+919876500002',
        purpose: 'Repair work',
        vehicleNo: 'KA02XY9999',
        status: 'CHECKED_OUT',
        validFrom: new Date(Date.now() - 4 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() - 2 * 60 * 60 * 1000),
        entryAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        exitAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        residentId: sunitaRes.id,
        name: 'Swiggy Delivery',
        phone: '+919876500003',
        purpose: 'Food delivery',
        status: 'CHECKED_IN',
        validFrom: todayStart,
        validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000),
        entryAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    ],
  });

  // ─── Service requests (mix of statuses + an SLA-overdue one) ───────────────
  await prisma.serviceRequest.deleteMany({ where: { societyId: society.id } });
  await prisma.serviceRequest.createMany({
    data: [
      {
        societyId: society.id,
        residentId: rahulRes.id,
        category: 'PLUMBING',
        description: 'Kitchen sink leaking. Water pooling under cabinet.',
        status: 'PENDING',
        slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: priyaRes.id,
        assignedToId: plumberStaff.id,
        category: 'ELECTRICAL',
        description: 'Living room ceiling fan making loud noise.',
        status: 'IN_PROGRESS',
        slaDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: amitRes.id,
        assignedToId: housekeepingStaff.id,
        category: 'CLEANING',
        description: 'Common corridor near 201 needs deep cleaning.',
        status: 'COMPLETED',
        resolvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        rating: 4.5,
        ratingText: 'Done well',
        ratedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: sunitaRes.id,
        category: 'CARPENTRY',
        description: 'Bedroom door hinges broken — door scraping floor.',
        status: 'PENDING',
        slaDeadline: new Date(Date.now() - 6 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: rahulRes.id,
        assignedToId: securityStaff.id,
        category: 'SECURITY',
        description: 'Main gate intercom not working.',
        status: 'ASSIGNED',
        slaDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    ],
  });

  // ─── Complaints ─────────────────────────────────────────────────────────────
  await prisma.complaint.deleteMany({ where: { societyId: society.id } });
  await prisma.complaint.createMany({
    data: [
      {
        societyId: society.id,
        residentId: rahulRes.id,
        category: 'NOISE',
        title: 'Loud music from B-201 past midnight',
        description: 'For the past three nights, B-201 has been playing loud music after 11pm.',
        status: 'OPEN',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: priyaRes.id,
        category: 'PARKING',
        title: 'Visitor cars in resident slots',
        description: 'Visitor parking is full again — visitors are using resident slots.',
        status: 'UNDER_REVIEW',
        adminNote: 'Investigating — checking gate logs.',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: amitRes.id,
        category: 'CLEANING',
        title: 'Garbage bins overflowing',
        description: 'B-block garbage chute has been overflowing for 2 days.',
        status: 'RESOLVED',
        adminNote: 'Cleaning vendor schedule increased to twice daily.',
        resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: sunitaRes.id,
        category: 'SECURITY',
        title: 'Stranger loitering near A-block',
        description: 'A man without ID was seen at the lobby for 30 minutes yesterday.',
        isAnonymous: true,
        status: 'OPEN',
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: rahulRes.id,
        category: 'PLUMBING',
        title: 'Common area water leak',
        description: 'Leak in basement near pump room.',
        status: 'RESOLVED',
        adminNote: 'Pipe joint replaced.',
        resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: priyaRes.id,
        category: 'ELECTRICAL',
        title: 'Lift outage on Tuesday',
        description: 'A-block lift was down for 4 hours.',
        status: 'CLOSED',
        adminNote: 'Maintenance contract renewed.',
        resolvedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // ─── More maintenance bills (overdue + paid) ───────────────────────────────
  const otherResidents = [priyaRes, amitRes, sunitaRes];
  await prisma.maintenanceBill.deleteMany({
    where: { flat: { societyId: society.id }, period: { in: ['2026-04', '2026-05'] }, residentId: { not: rahulRes.id } },
  });
  await prisma.maintenanceBill.createMany({
    skipDuplicates: true,
    data: [
      ...otherResidents.map((r) => ({
        flatId: r.flatId,
        residentId: r.id,
        period: '2026-05',
        breakdown: { maintenance: 3200, water: 450, parking: 350 } as any,
        total: 4000 as any,
        dueDate: new Date('2026-05-10'),
        status: 'PENDING' as const,
      })),
      {
        flatId: priyaRes.flatId,
        residentId: priyaRes.id,
        period: '2026-04',
        breakdown: { maintenance: 3200, water: 450, parking: 350 } as any,
        total: 4000 as any,
        dueDate: new Date('2026-04-10'),
        status: 'FAILED' as const, // overdue
      },
      {
        flatId: amitRes.flatId,
        residentId: amitRes.id,
        period: '2026-04',
        breakdown: { maintenance: 3200, water: 450, parking: 350 } as any,
        total: 4000 as any,
        dueDate: new Date('2026-04-10'),
        status: 'SUCCESS' as const,
      },
      {
        flatId: sunitaRes.flatId,
        residentId: sunitaRes.id,
        period: '2026-04',
        breakdown: { maintenance: 3200, water: 450, parking: 350 } as any,
        total: 4000 as any,
        dueDate: new Date('2026-04-10'),
        status: 'SUCCESS' as const,
      },
    ],
  });

  // ─── SOS alerts (one active for testing the active queue) ──────────────────
  await prisma.sosAlert.deleteMany({ where: { societyId: society.id } });
  await prisma.sosAlert.createMany({
    data: [
      {
        societyId: society.id,
        residentId: rahulRes.userId,
        note: 'Father feeling chest pain — need immediate help',
        lat: 12.9716,
        lng: 77.5946,
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        societyId: society.id,
        residentId: priyaRes.userId,
        note: 'Smoke seen near B-block stairwell',
        lat: 12.9717,
        lng: 77.5947,
        status: 'RESOLVED',
        acknowledgedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
        resolvedAt: new Date(Date.now() - 19 * 60 * 60 * 1000),
        responseTimeSecs: 180,
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      },
    ],
  });

  // ─── Leave requests ────────────────────────────────────────────────────────
  await prisma.leaveRequest.deleteMany({ where: { staff: { societyId: society.id } } });
  await prisma.leaveRequest.createMany({
    data: [
      {
        staffId: securityStaff.id,
        type: 'CASUAL',
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        reason: 'Family wedding',
        status: 'PENDING',
      },
      {
        staffId: housekeepingStaff.id,
        type: 'SICK',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reason: 'Fever',
        status: 'PENDING',
      },
      {
        staffId: plumberStaff.id,
        type: 'CASUAL',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        reason: 'Personal',
        status: 'APPROVED',
        adminNote: 'Approved as casual leave.',
      },
    ],
  });

  // ─── Property listings ─────────────────────────────────────────────────────
  await prisma.propertyListing.deleteMany({ where: { societyId: society.id } });
  await prisma.propertyListing.createMany({
    data: [
      {
        societyId: society.id,
        residentId: amitRes.id,
        areaSqft: 950,
        price: 6500000 as any,
        furnished: true,
        description: '2BHK fully furnished, west-facing, A-201',
        photos: [],
        status: 'DRAFT', // pending admin approval
      },
      {
        societyId: society.id,
        residentId: sunitaRes.id,
        areaSqft: 1100,
        price: 7800000 as any,
        furnished: false,
        description: '3BHK semi-furnished, B-block, ready to move',
        photos: [],
        status: 'ACTIVE',
      },
    ],
  });

  // ─── Travel pauses ─────────────────────────────────────────────────────────
  await prisma.travelPause.deleteMany({ where: { resident: { user: { societyId: society.id } } } });
  await prisma.travelPause.createMany({
    data: [
      {
        residentId: priyaRes.id,
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        returnDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        servicesPaused: ['HOUSEKEEPING', 'NEWSPAPER'],
        reason: 'Vacation',
        status: 'PENDING',
      },
      {
        residentId: rahulRes.id,
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        returnDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        servicesPaused: ['HOUSEKEEPING'],
        reason: 'Family visit',
        status: 'ACTIVE',
      },
    ],
  });

  // ─── Event registrations + feedback ────────────────────────────────────────
  const events = await prisma.event.findMany({ where: { societyId: society.id } });
  if (events.length > 0) {
    await prisma.eventRegistration.deleteMany({ where: { eventId: { in: events.map((e) => e.id) } } });
    const yogaEvent = events.find((e) => e.title.includes('Yoga'));
    if (yogaEvent) {
      await prisma.eventRegistration.createMany({
        data: [
          { eventId: yogaEvent.id, residentId: rahulRes.id, waitlisted: false },
          { eventId: yogaEvent.id, residentId: priyaRes.id, waitlisted: false },
          { eventId: yogaEvent.id, residentId: amitRes.id, waitlisted: false },
        ],
      });
    }
  }

  // Past completed event with feedback (for admin /events/:id/feedback view)
  const pastEvent = await prisma.event.upsert({
    where: { id: 'b1c2d3e4-f5a6-4789-9abc-def012345678' },
    update: {},
    create: {
      id: 'b1c2d3e4-f5a6-4789-9abc-def012345678',
      societyId: society.id,
      title: 'Holi Celebration 2026',
      description: 'Society Holi with colours, music & food.',
      category: 'FESTIVAL',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      venue: 'Lawn Area',
      capacity: 100,
      status: 'COMPLETED',
    },
  });
  await prisma.eventRegistration.deleteMany({ where: { eventId: pastEvent.id } });
  await prisma.eventRegistration.createMany({
    data: [
      { eventId: pastEvent.id, residentId: rahulRes.id, waitlisted: false },
      { eventId: pastEvent.id, residentId: priyaRes.id, waitlisted: false },
      { eventId: pastEvent.id, residentId: amitRes.id, waitlisted: false },
      { eventId: pastEvent.id, residentId: sunitaRes.id, waitlisted: false },
    ],
  });
  await prisma.eventFeedback.deleteMany({ where: { eventId: pastEvent.id } });
  await prisma.eventFeedback.createMany({
    data: [
      { eventId: pastEvent.id, residentId: rahulRes.id, rating: 4.5 as any, comment: 'Loved it! Music was great.' },
      { eventId: pastEvent.id, residentId: priyaRes.id, rating: 5 as any, comment: 'Best Holi in years.' },
      { eventId: pastEvent.id, residentId: amitRes.id, rating: 3.5 as any, comment: 'Food ran out early.' },
      { eventId: pastEvent.id, residentId: sunitaRes.id, rating: 4 as any },
    ],
  });

  // ─── Society config (feature flags + emergency contacts so settings page is populated) ─
  await prisma.society.update({
    where: { id: society.id },
    data: {
      config: {
        features: {
          canteen: true,
          events: true,
          medical: true,
          preOrders: true,
          propertyListings: true,
          travelPause: true,
        },
        billing: {
          baseMaintenance: 3200,
          parking: 350,
          water: 450,
          penaltyPerDay: 50,
        },
        slaConfig: {
          Plumbing: 4,
          Electrical: 2,
          Cleaning: 8,
          Carpentry: 24,
          Security: 1,
          Other: 12,
        },
        contactEmail: 'admin@greenvalley.com',
        contactPhone: '+919876543210',
        emergencyContacts: [
          { id: 'ec-medical', label: 'Medical', phone: '+91-108' },
          { id: 'ec-security', label: 'Security', phone: '+91-9000000099' },
          { id: 'ec-fire', label: 'Fire', phone: '+91-101' },
        ],
      } as any,
    },
  });

  // ─── Amenities + Bookings ──────────────────────────────────────────────────
  await prisma.amenityBooking.deleteMany({ where: { amenity: { societyId: society.id } } });
  await prisma.amenity.deleteMany({ where: { societyId: society.id } });
  const amenityRows = [
    { name: 'Gymnasium', description: 'Fully equipped gym with cardio + weights', capacity: 20, depositAmount: 0 as any, rules: 'No outside footwear. Wipe equipment after use.' },
    { name: 'Swimming Pool', description: 'Outdoor pool, 25m', capacity: 25, depositAmount: 500 as any, rules: 'Swim caps mandatory. Children must be supervised.' },
    { name: 'Clubhouse', description: 'Multi-purpose clubhouse with TV and lounge', capacity: 40, depositAmount: 1000 as any, rules: 'No smoking. Bookings up to 4 hours.' },
    { name: 'Party Hall', description: 'Banquet hall for celebrations', capacity: 80, depositAmount: 5000 as any, rules: 'Music off by 10pm. Cleaning charges apply.' },
    { name: 'Tennis Court', description: 'Synthetic tennis court', capacity: 4, depositAmount: 200 as any, rules: 'Tennis shoes only. 1-hour slots.' },
  ];
  const amenities: { id: string; name: string }[] = [];
  for (const a of amenityRows) {
    const created = await prisma.amenity.create({
      data: { ...a, societyId: society.id, photos: [] as any },
    });
    amenities.push({ id: created.id, name: created.name });
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await prisma.amenityBooking.createMany({
    data: [
      { amenityId: amenities[0].id, residentId: rahulRes.id, date: new Date(today.getTime() + 24 * 60 * 60 * 1000), startSlot: '06:00', endSlot: '07:00', guestCount: 1, status: 'CONFIRMED', paymentStatus: 'SUCCESS' },
      { amenityId: amenities[1].id, residentId: priyaRes.id, date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), startSlot: '17:00', endSlot: '18:00', guestCount: 2, status: 'PENDING', paymentStatus: 'PENDING' },
      { amenityId: amenities[3].id, residentId: amitRes.id, date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), startSlot: '19:00', endSlot: '23:00', guestCount: 30, status: 'CONFIRMED', paymentStatus: 'SUCCESS', depositPaid: true },
      { amenityId: amenities[4].id, residentId: sunitaRes.id, date: new Date(today.getTime() - 24 * 60 * 60 * 1000), startSlot: '07:00', endSlot: '08:00', guestCount: 2, status: 'COMPLETED', paymentStatus: 'SUCCESS', rating: 4.5 as any, ratingText: 'Court was clean', ratingAt: new Date() },
    ],
  });

  // ─── Vendors ───────────────────────────────────────────────────────────────
  await prisma.vendor.deleteMany({ where: { societyId: society.id } });
  await prisma.vendor.createMany({
    data: [
      { societyId: society.id, name: 'Sharma Electricals', category: 'OTHER', phone: '+919800000001' },
      { societyId: society.id, name: 'QuickFix Plumbing', category: 'OTHER', phone: '+919800000002' },
      { societyId: society.id, name: 'GreenThumb Gardening', category: 'OTHER', phone: '+919800000003' },
      { societyId: society.id, name: 'BugOff Pest Control', category: 'OTHER', phone: '+919800000004' },
      { societyId: society.id, name: 'SafeGuard Security Services', category: 'OTHER', phone: '+919800000005' },
      { societyId: society.id, name: 'SparkleClean Cleaning', category: 'OTHER', phone: '+919800000006' },
      { societyId: society.id, name: 'FreshFarm Vegetables', category: 'VEGETABLES', phone: '+919800000007' },
      { societyId: society.id, name: 'DailyMilk Dairy', category: 'DAIRY', phone: '+919800000008' },
    ],
  });

  // ─── Packages ──────────────────────────────────────────────────────────────
  await prisma.package.deleteMany({ where: { societyId: society.id } });
  await prisma.package.createMany({
    data: [
      { residentId: rahulRes.id, societyId: society.id, courierName: 'Amazon', trackingNumber: 'AMZ123456', description: 'Electronics', photoUrl: 'https://placehold.co/200', status: 'PENDING', arrivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      { residentId: rahulRes.id, societyId: society.id, courierName: 'Flipkart', trackingNumber: 'FK789012', description: 'Books', photoUrl: 'https://placehold.co/200', status: 'COLLECTED', arrivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), collectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { residentId: priyaRes.id, societyId: society.id, courierName: 'Myntra', trackingNumber: 'MY555444', description: 'Apparel', photoUrl: 'https://placehold.co/200', status: 'PENDING', arrivedAt: new Date(Date.now() - 30 * 60 * 1000) },
      { residentId: priyaRes.id, societyId: society.id, courierName: 'BlueDart', trackingNumber: 'BD111222', description: 'Documents', photoUrl: 'https://placehold.co/200', status: 'COLLECTED', arrivedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), collectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { residentId: amitRes.id, societyId: society.id, courierName: 'Amazon', trackingNumber: 'AMZ333444', description: 'Kitchen items', photoUrl: 'https://placehold.co/200', status: 'PENDING', arrivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      { residentId: amitRes.id, societyId: society.id, courierName: 'DTDC', description: 'Gift box', photoUrl: 'https://placehold.co/200', status: 'COLLECTED', arrivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), collectedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
      { residentId: sunitaRes.id, societyId: society.id, courierName: 'Delhivery', trackingNumber: 'DL999888', description: 'Home decor', photoUrl: 'https://placehold.co/200', status: 'PENDING', arrivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000) },
      { residentId: sunitaRes.id, societyId: society.id, courierName: 'Amazon', trackingNumber: 'AMZ777666', description: 'Groceries', photoUrl: 'https://placehold.co/200', status: 'COLLECTED', arrivedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), collectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { residentId: rahulRes.id, societyId: society.id, courierName: 'Ekart', description: 'Mobile accessory', photoUrl: 'https://placehold.co/200', status: 'PENDING', arrivedAt: new Date(Date.now() - 90 * 60 * 1000) },
      { residentId: priyaRes.id, societyId: society.id, courierName: 'XpressBees', description: 'Pharmacy', photoUrl: 'https://placehold.co/200', status: 'PENDING', arrivedAt: new Date(Date.now() - 15 * 60 * 1000) },
    ],
  });

  // ─── Document Requests ─────────────────────────────────────────────────────
  await prisma.documentRequest.deleteMany({ where: { societyId: society.id } });
  await prisma.documentRequest.createMany({
    data: [
      { residentId: rahulRes.id, societyId: society.id, type: 'NOC', purpose: 'Bank loan application', requiredBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status: 'PENDING' },
      { residentId: priyaRes.id, societyId: society.id, type: 'OWNERSHIP_CERT', purpose: 'Property records update', status: 'PROCESSING', adminNotes: 'Pulling records from registrar.' },
      { residentId: amitRes.id, societyId: society.id, type: 'PAYMENT_CERT', purpose: 'Income tax filing', status: 'READY', documentUrl: 'https://placehold.co/document.pdf' },
      { residentId: sunitaRes.id, societyId: society.id, type: 'NOC', purpose: 'Renovation NOC for civil work', requiredBy: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), status: 'PENDING' },
      { residentId: rahulRes.id, societyId: society.id, type: 'OTHER', purpose: 'Address proof for passport', status: 'DELIVERED', documentUrl: 'https://placehold.co/address.pdf', rating: 4.5 as any },
      { residentId: priyaRes.id, societyId: society.id, type: 'PAYMENT_CERT', purpose: 'HRA exemption proof', status: 'PROCESSING' },
    ],
  });

  // ─── Domestic Helps ────────────────────────────────────────────────────────
  await prisma.domesticHelp.deleteMany({ where: { resident: { user: { societyId: society.id } } } });
  await prisma.domesticHelp.createMany({
    data: [
      { residentId: rahulRes.id, name: 'Lakshmi Devi', role: 'MAID', phone: '+919700000001', salary: 8000 as any, isActive: true },
      { residentId: rahulRes.id, name: 'Ramesh Kumar', role: 'DRIVER', phone: '+919700000002', salary: 18000 as any, isActive: true },
      { residentId: priyaRes.id, name: 'Sita Bai', role: 'COOK', phone: '+919700000003', salary: 10000 as any, isActive: true },
      { residentId: priyaRes.id, name: 'Manju', role: 'MAID', phone: '+919700000004', salary: 7500 as any, isActive: true },
      { residentId: amitRes.id, name: 'Govind Singh', role: 'DRIVER', phone: '+919700000005', salary: 17000 as any, isActive: true },
      { residentId: amitRes.id, name: 'Rekha', role: 'MAID', phone: '+919700000006', salary: 8500 as any, isActive: true },
      { residentId: sunitaRes.id, name: 'Anand Mali', role: 'GARDENER', phone: '+919700000007', salary: 6000 as any, isActive: false },
      { residentId: sunitaRes.id, name: 'Geeta', role: 'COOK', phone: '+919700000008', salary: 11000 as any, isActive: true },
    ],
  });

  // ─── Pest Control Schedules ────────────────────────────────────────────────
  await prisma.pestControlSchedule.deleteMany({ where: { societyId: society.id } });
  await prisma.pestControlSchedule.createMany({
    data: [
      { societyId: society.id, type: 'MOSQUITO', scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), areas: ['Basement', 'Garden'], notes: 'Fogging in evening hours', status: 'SCHEDULED' },
      { societyId: society.id, type: 'COCKROACH', scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), areas: ['Common kitchens', 'Garbage chute'], status: 'SCHEDULED' },
      { societyId: society.id, type: 'RODENT', scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), areas: ['Basement parking'], status: 'COMPLETED', completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { societyId: society.id, type: 'GENERAL', scheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), areas: ['Entire premises'], notes: 'Quarterly treatment', status: 'SCHEDULED' },
    ],
  });

  // ─── Laundry Bookings ──────────────────────────────────────────────────────
  await prisma.laundryBooking.deleteMany({ where: { societyId: society.id } });
  await prisma.laundryBooking.createMany({
    data: [
      { societyId: society.id, residentId: rahulRes.id, scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), type: 'WASH_AND_FOLD', itemCount: 12, status: 'SCHEDULED' },
      { societyId: society.id, residentId: priyaRes.id, scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000), type: 'DRY_CLEAN', itemCount: 4, notes: 'Silk sarees - handle with care', status: 'IN_PROGRESS', pickedUpAt: new Date(Date.now() - 20 * 60 * 60 * 1000) },
      { societyId: society.id, residentId: amitRes.id, scheduledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), type: 'WASH_AND_IRON', itemCount: 8, status: 'DELIVERED', pickedUpAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { societyId: society.id, residentId: sunitaRes.id, scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), type: 'IRON_ONLY', itemCount: 6, status: 'SCHEDULED' },
      { societyId: society.id, residentId: rahulRes.id, scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), type: 'WASH_AND_FOLD', itemCount: 15, status: 'DELIVERED', pickedUpAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    ],
  });

  // ─── Concierge Requests ────────────────────────────────────────────────────
  await prisma.conciergeRequest.deleteMany({ where: { societyId: society.id } });
  await prisma.conciergeRequest.createMany({
    data: [
      { societyId: society.id, residentId: rahulRes.id, type: 'TAXI', description: 'Cab to airport, 5am tomorrow', scheduledTime: new Date(Date.now() + 18 * 60 * 60 * 1000), status: 'PENDING' },
      { societyId: society.id, residentId: priyaRes.id, type: 'PHARMACY', description: 'Pick up insulin from Apollo Pharmacy', status: 'IN_PROGRESS', assignedStaffId: securityStaff.id },
      { societyId: society.id, residentId: amitRes.id, type: 'COURIER', description: 'Send legal documents via Blue Dart', status: 'COMPLETED', completionNotes: 'Dispatched at 11am', rating: 5 as any, ratingText: 'Very prompt' },
      { societyId: society.id, residentId: sunitaRes.id, type: 'FORM_HELP', description: 'Help filling Aadhaar correction form', status: 'ASSIGNED', assignedStaffId: housekeepingStaff.id },
      { societyId: society.id, residentId: rahulRes.id, type: 'OTHER', description: 'Collect saree from tailor near gate 2', status: 'PENDING' },
    ],
  });

  // ─── Vehicles ──────────────────────────────────────────────────────────────
  await prisma.vehicle.deleteMany({ where: { resident: { user: { societyId: society.id } } } });
  await prisma.vehicle.createMany({
    data: [
      { residentId: rahulRes.id, plateNumber: 'KA01AB1234', make: 'Honda', model: 'City', color: 'White', type: 'CAR' },
      { residentId: rahulRes.id, plateNumber: 'KA01CD5678', make: 'Royal Enfield', model: 'Classic 350', color: 'Black', type: 'TWO_WHEELER' },
      { residentId: priyaRes.id, plateNumber: 'KA02EF1111', make: 'Hyundai', model: 'Creta', color: 'Silver', type: 'SUV' },
      { residentId: priyaRes.id, plateNumber: 'KA02GH2222', make: 'Honda', model: 'Activa', color: 'Blue', type: 'TWO_WHEELER' },
      { residentId: amitRes.id, plateNumber: 'KA03IJ3333', make: 'Maruti', model: 'Swift', color: 'Red', type: 'CAR' },
      { residentId: amitRes.id, plateNumber: 'KA03KL4444', make: 'Bajaj', model: 'Pulsar', color: 'Black', type: 'TWO_WHEELER' },
      { residentId: sunitaRes.id, plateNumber: 'KA04MN5555', make: 'Toyota', model: 'Innova', color: 'Grey', type: 'SUV' },
      { residentId: sunitaRes.id, plateNumber: 'KA04OP6666', make: 'TVS', model: 'Jupiter', color: 'White', type: 'TWO_WHEELER' },
      { residentId: rahulRes.id, plateNumber: 'KA05QR7777', make: 'Tata', model: 'Nexon', color: 'Blue', type: 'SUV' },
      { residentId: priyaRes.id, plateNumber: 'KA05ST8888', make: 'Kia', model: 'Seltos', color: 'Black', type: 'SUV', isActive: false },
    ],
  });

  // ─── Audit Logs ────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.findFirstOrThrow({ where: { societyId: society.id, role: 'ADMIN' } });
  await prisma.auditLog.deleteMany({ where: { societyId: society.id } });
  const auditEntries: Array<{ entityType: string; action: string; module: string; routePath: string; method: string }> = [
    { entityType: 'Resident', action: 'APPROVE', module: 'residents', routePath: '/admin/residents', method: 'POST' },
    { entityType: 'ServiceRequest', action: 'ASSIGN', module: 'service-requests', routePath: '/admin/service-requests', method: 'POST' },
    { entityType: 'Complaint', action: 'RESOLVE', module: 'complaints', routePath: '/admin/complaints', method: 'PATCH' },
    { entityType: 'Notice', action: 'CREATE', module: 'notices', routePath: '/admin/notices', method: 'POST' },
    { entityType: 'Notice', action: 'UPDATE', module: 'notices', routePath: '/admin/notices', method: 'PATCH' },
    { entityType: 'Event', action: 'CREATE', module: 'events', routePath: '/admin/events', method: 'POST' },
    { entityType: 'Event', action: 'PUBLISH', module: 'events', routePath: '/admin/events', method: 'PATCH' },
    { entityType: 'StaffMember', action: 'CREATE', module: 'staff', routePath: '/admin/staff', method: 'POST' },
    { entityType: 'LeaveRequest', action: 'APPROVE', module: 'staff', routePath: '/admin/staff/leaves', method: 'PATCH' },
    { entityType: 'MaintenanceBill', action: 'GENERATE', module: 'billing', routePath: '/admin/billing', method: 'POST' },
    { entityType: 'PropertyListing', action: 'APPROVE', module: 'property', routePath: '/admin/property-listings', method: 'PATCH' },
    { entityType: 'Society', action: 'UPDATE_CONFIG', module: 'settings', routePath: '/admin/settings', method: 'PATCH' },
    { entityType: 'SosAlert', action: 'ACKNOWLEDGE', module: 'sos', routePath: '/admin/sos', method: 'PATCH' },
    { entityType: 'DocumentRequest', action: 'UPDATE_STATUS', module: 'documents', routePath: '/admin/document-requests', method: 'PATCH' },
    { entityType: 'AmenityBooking', action: 'CONFIRM', module: 'amenities', routePath: '/admin/amenities', method: 'PATCH' },
    { entityType: 'User', action: 'LOGIN', module: 'auth', routePath: '/auth/login', method: 'POST' },
    { entityType: 'Visitor', action: 'CHECK_IN', module: 'visitors', routePath: '/admin/visitors', method: 'POST' },
    { entityType: 'Package', action: 'COLLECT', module: 'packages', routePath: '/admin/packages', method: 'PATCH' },
    { entityType: 'Vendor', action: 'CREATE', module: 'vendors', routePath: '/admin/vendors', method: 'POST' },
    { entityType: 'AgmMeeting', action: 'CREATE', module: 'agm', routePath: '/admin/agm', method: 'POST' },
  ];
  await prisma.auditLog.createMany({
    data: auditEntries.map((e, i) => ({
      entityType: e.entityType,
      entityId: `entity-${i}`,
      action: e.action,
      module: e.module,
      routePath: e.routePath,
      method: e.method,
      ipAddress: '127.0.0.1',
      userAgent: 'AdminWeb/1.0',
      actorId: adminUser.id,
      actorRole: 'ADMIN',
      societyId: society.id,
      createdAt: new Date(Date.now() - i * 60 * 60 * 1000),
    })),
  });

  // ─── Wallet Transactions ───────────────────────────────────────────────────
  await prisma.walletTransaction.deleteMany({ where: { resident: { user: { societyId: society.id } } } });
  const walletResidents = [rahulRes, priyaRes, amitRes, sunitaRes];
  const walletData = [];
  for (let i = 0; i < 12; i++) {
    const r = walletResidents[i % walletResidents.length];
    const isCredit = i % 3 === 0;
    walletData.push({
      residentId: r.id,
      amount: (isCredit ? 1000 + i * 100 : -(200 + i * 50)) as any,
      type: (isCredit ? 'CREDIT' : 'DEBIT') as 'CREDIT' | 'DEBIT',
      status: (i === 11 ? 'PENDING' : 'COMPLETED') as 'PENDING' | 'COMPLETED',
      description: isCredit ? 'Top-up via UPI' : 'Maintenance bill payment',
      reference: `TXN${100000 + i}`,
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.walletTransaction.createMany({ data: walletData });

  // ─── Society Budgets ───────────────────────────────────────────────────────
  await prisma.societyBudget.deleteMany({ where: { societyId: society.id } });
  const now = new Date();
  await prisma.societyBudget.createMany({
    data: [
      {
        societyId: society.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        totalIncome: 480000 as any,
        lineItems: [
          { category: 'Maintenance', allocated: 200000, spent: 145000 },
          { category: 'Security', allocated: 120000, spent: 110000 },
          { category: 'Housekeeping', allocated: 80000, spent: 72000 },
          { category: 'Gardening', allocated: 30000, spent: 24000 },
          { category: 'Utilities', allocated: 40000, spent: 38000 },
          { category: 'Repairs', allocated: 10000, spent: 6000 },
        ] as any,
      },
      {
        societyId: society.id,
        month: now.getMonth() === 0 ? 12 : now.getMonth(),
        year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
        totalIncome: 460000 as any,
        lineItems: [
          { category: 'Maintenance', allocated: 200000, spent: 198000 },
          { category: 'Security', allocated: 120000, spent: 119000 },
          { category: 'Housekeeping', allocated: 80000, spent: 80000 },
          { category: 'Gardening', allocated: 30000, spent: 28000 },
          { category: 'Utilities', allocated: 40000, spent: 41000 },
        ] as any,
      },
    ],
  });

  // ─── AGM Meetings + Resolutions ────────────────────────────────────────────
  await prisma.agmResolution.deleteMany({ where: { meeting: { societyId: society.id } } });
  await prisma.agmMeeting.deleteMany({ where: { societyId: society.id } });
  const upcomingAgm = await prisma.agmMeeting.create({
    data: {
      societyId: society.id,
      title: 'Annual General Meeting 2026',
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      agenda: [
        'Approval of FY25 financials',
        'Election of new committee',
        'Maintenance hike proposal',
        'Solar installation discussion',
      ] as any,
      status: 'UPCOMING',
    },
  });
  const pastAgm = await prisma.agmMeeting.create({
    data: {
      societyId: society.id,
      title: 'Special General Meeting Q1 2026',
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      agenda: ['CCTV upgrade', 'Lift modernization'] as any,
      status: 'COMPLETED',
      minutesUrl: 'https://placehold.co/agm-minutes.pdf',
    },
  });
  const meetingForFuture = await prisma.agmMeeting.create({
    data: {
      societyId: society.id,
      title: 'Quarterly Review Q2 2026',
      date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      agenda: ['Budget review', 'New vendor proposals'] as any,
      status: 'UPCOMING',
    },
  });
  await prisma.agmResolution.createMany({
    data: [
      { meetingId: upcomingAgm.id, title: 'Increase maintenance to Rs 4500/month', description: 'To cover rising security and utility costs.', result: 'PENDING' },
      { meetingId: upcomingAgm.id, title: 'Install rooftop solar', description: 'Phase 1: A-block rooftop, est. 50kW.', result: 'PENDING' },
      { meetingId: pastAgm.id, title: 'CCTV upgrade to 4K', description: 'Upgrade all 24 cameras.', result: 'PASSED', votes: { yes: 28, no: 4, abstain: 2 } as any },
      { meetingId: pastAgm.id, title: 'Lift modernization A-block', description: 'Replace 15-year-old lift hardware.', result: 'PASSED', votes: { yes: 30, no: 2, abstain: 2 } as any },
      { meetingId: pastAgm.id, title: 'Pet ban in lifts', description: 'Restrict pets in lifts after 7pm.', result: 'REJECTED', votes: { yes: 8, no: 22, abstain: 4 } as any },
      { meetingId: meetingForFuture.id, title: 'Approve new gardening vendor', description: 'Replace existing vendor due to service issues.', result: 'PENDING' },
    ],
  });

  // ─── Community Posts ───────────────────────────────────────────────────────
  await prisma.communityPost.deleteMany({ where: { societyId: society.id } });
  await prisma.communityPost.createMany({
    data: [
      { residentId: rahulRes.id, societyId: society.id, content: 'Lost a black umbrella near gate 1 yesterday evening. If anyone has seen it please DM me!', status: 'ACTIVE', reactions: 5 },
      { residentId: priyaRes.id, societyId: society.id, content: 'Selling barely-used kids cycle (5-8 yrs). DM if interested.', photoUrls: ['https://placehold.co/cycle.jpg'] as any, status: 'ACTIVE', reactions: 12 },
      { residentId: amitRes.id, societyId: society.id, content: 'Highly recommend the new fruit vendor at gate 2 — fresh stock every morning.', status: 'ACTIVE', reactions: 18 },
      { residentId: sunitaRes.id, societyId: society.id, content: 'Anyone else having intermittent water pressure issues on the 4th floor?', status: 'ACTIVE', reactions: 7 },
      { residentId: rahulRes.id, societyId: society.id, content: 'Free yoga sessions every Sunday 7am at the terrace. All welcome.', status: 'ACTIVE', reactions: 22 },
      { residentId: priyaRes.id, societyId: society.id, content: 'Found a set of car keys near the clubhouse. Drop a comment if yours.', status: 'ACTIVE', reactions: 3 },
      { residentId: amitRes.id, societyId: society.id, content: 'Sharing a tiffin service contact — very reliable, home-style food.', isAnonymous: true, status: 'ACTIVE', reactions: 9 },
      { residentId: sunitaRes.id, societyId: society.id, content: 'Old post — please ignore.', status: 'REMOVED', reactions: 0 },
      { residentId: rahulRes.id, societyId: society.id, content: 'Diwali decoration committee — meeting Saturday at 5pm in clubhouse.', status: 'ACTIVE', reactions: 14 },
      { residentId: priyaRes.id, societyId: society.id, content: 'Carpool option for Whitefield IT park — anyone interested?', status: 'ACTIVE', reactions: 6 },
    ],
  });

  // ─── Infrastructure Items ──────────────────────────────────────────────────
  await prisma.infrastructureItem.deleteMany({ where: { societyId: society.id } });
  await prisma.infrastructureItem.createMany({
    data: [
      { societyId: society.id, name: 'A-Block Lift 1', type: 'LIFT', status: 'OPERATIONAL' },
      { societyId: society.id, name: 'A-Block Lift 2', type: 'LIFT', status: 'MAINTENANCE' },
      { societyId: society.id, name: 'B-Block Lift 1', type: 'LIFT', status: 'OPERATIONAL' },
      { societyId: society.id, name: 'Main Power Backup Generator', type: 'GENERATOR', status: 'OPERATIONAL' },
      { societyId: society.id, name: 'Borewell Pump 1', type: 'WATER', status: 'FAULT' },
      { societyId: society.id, name: 'Borewell Pump 2', type: 'WATER', status: 'OPERATIONAL' },
      { societyId: society.id, name: 'Common Area WiFi', type: 'WIFI', status: 'OPERATIONAL' },
      { societyId: society.id, name: 'Mains Power Connection', type: 'POWER', status: 'OPERATIONAL' },
    ],
  });

  // ─── Emergency Contacts (separate model) ───────────────────────────────────
  await prisma.emergencyContact.deleteMany({ where: { societyId: society.id } });
  await prisma.emergencyContact.createMany({
    data: [
      { societyId: society.id, label: 'Society Security Desk', phone: '+919000000099', priority: 1 },
      { societyId: society.id, label: 'Medical Emergency (Ambulance)', phone: '108', priority: 2 },
      { societyId: society.id, label: 'Local Police Station', phone: '100', priority: 3 },
      { societyId: society.id, label: 'Fire Brigade', phone: '101', priority: 4 },
      { societyId: society.id, label: 'Society Admin Office', phone: '+919876543210', priority: 5 },
    ],
  });

  // ─── Appointments (residents <-> medical staff) ────────────────────────────
  const medicalStaffAll = await prisma.medicalStaff.findMany({ where: { societyId: society.id } });
  if (medicalStaffAll.length >= 2) {
    const doc1 = medicalStaffAll[0];
    const doc2 = medicalStaffAll[1];
    const apptDate = (offsetDays: number) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offsetDays); return d;
    };
    await prisma.appointment.deleteMany({ where: { doctor: { societyId: society.id } } });
    await prisma.appointment.createMany({
      data: [
        { residentId: rahulRes.id, doctorId: doc1.id, date: apptDate(2), timeSlot: '09:00', status: 'BOOKED', notes: 'Routine BP check' },
        { residentId: priyaRes.id, doctorId: doc1.id, date: apptDate(2), timeSlot: '10:00', status: 'CONFIRMED' },
        { residentId: amitRes.id, doctorId: doc2.id, date: apptDate(3), timeSlot: '11:00', status: 'BOOKED', notes: 'Knee pain' },
        { residentId: sunitaRes.id, doctorId: doc2.id, date: apptDate(-2), timeSlot: '15:00', status: 'COMPLETED', rating: 4.5 as any, ratingText: 'Very thorough' },
        { residentId: rahulRes.id, doctorId: doc1.id, date: apptDate(-7), timeSlot: '09:30', status: 'COMPLETED', rating: 5 as any },
        { residentId: priyaRes.id, doctorId: doc2.id, date: apptDate(-3), timeSlot: '16:00', status: 'CANCELLED', cancelReason: 'Scheduling conflict' },
      ],
    });
  }

  // ─── Feedback ──────────────────────────────────────────────────────────────
  await prisma.feedback.deleteMany({ where: { societyId: society.id } });
  await prisma.feedback.createMany({
    data: [
      { residentId: rahulRes.id, societyId: society.id, category: 'SUGGESTION', message: 'Add a kids play area near the clubhouse.', status: 'SUBMITTED' },
      { residentId: priyaRes.id, societyId: society.id, category: 'COMPLAINT', message: 'Garbage collection often delayed on Sundays.', status: 'ACKNOWLEDGED', adminReply: 'Coordinating with vendor.' },
      { residentId: amitRes.id, societyId: society.id, category: 'APPRECIATION', message: 'Security team handled last week incident professionally.', status: 'RESOLVED', rating: 5 as any },
      { residentId: sunitaRes.id, societyId: society.id, category: 'SUGGESTION', message: 'EV charging point in basement parking.', status: 'ACKNOWLEDGED', adminReply: 'Under review with builder.' },
      { residentId: rahulRes.id, societyId: society.id, category: 'COMPLAINT', message: 'Lift A2 buttons unresponsive sometimes.', status: 'RESOLVED', adminReply: 'Buttons replaced.', rating: 4 as any },
      { residentId: priyaRes.id, societyId: society.id, category: 'APPRECIATION', message: 'Loved the recent Holi event organization!', isAnonymous: true, status: 'SUBMITTED' },
      { residentId: amitRes.id, societyId: society.id, category: 'OTHER', message: 'Can we get an admin office help-desk window 6-8pm?', status: 'SUBMITTED' },
      { residentId: sunitaRes.id, societyId: society.id, category: 'SUGGESTION', message: 'Monthly newsletter would be helpful.', status: 'ACKNOWLEDGED' },
    ],
  });

  console.log('Seed complete. Society ID:', society.id);
  console.log('Admin login: phone +919000000001, OTP 123456 (dev mode).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
