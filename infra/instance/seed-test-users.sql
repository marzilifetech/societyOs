-- ════════════════════════════════════════════════════════════════════════════
--  SocietyOS dev/staging — TEST USERS on the 11111 reserved series.
--
--  The 11111 series (1111100000–1111199999) is a reserved test range the Marzi
--  auth backend accepts with a fixed test OTP, so these accounts can log in on
--  dev without a real SIM. Stored normalized as +9111111xxxxx (see
--  normalizeIndianPhone: 10 digits -> +91 prefix).
--
--  Society: Green Valley Heights (a1b2c3d4-e5f6-4789-abcd-ef0123456789).
--  Idempotent: re-running upserts (ON CONFLICT ... DO UPDATE), never duplicates.
--  Series mapping:
--    Residents  +911111100001 .. +911111100005  (block 'T' flats T-101..T-105)
--    Staff      +911111110001 .. +911111110004  (security/housekeeping/maint/supervisor)
-- ════════════════════════════════════════════════════════════════════════════

-- ── Residents (each mapped to a dedicated 'T' block flat) ───────────────────
DO $$
DECLARE
  soc  text := 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
  uid  uuid;
  fid  uuid;
  rec  record;
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    ('+911111100001', 'Test Resident One',   '101'),
    ('+911111100002', 'Test Resident Two',   '102'),
    ('+911111100003', 'Test Resident Three', '103'),
    ('+911111100004', 'Test Resident Four',  '104'),
    ('+911111100005', 'Test Resident Five',  '105')
  ) AS t(phone, name, flatno)
  LOOP
    INSERT INTO flats (id, "societyId", block, floor, number, "areaSqft")
    VALUES (gen_random_uuid(), soc, 'T', 1, rec.flatno, 950)
    ON CONFLICT ("societyId", block, number) DO UPDATE SET floor = EXCLUDED.floor
    RETURNING id INTO fid;

    INSERT INTO users (id, phone, name, role, status, "societyId", "updatedAt")
    VALUES (gen_random_uuid(), rec.phone, rec.name, 'RESIDENT', 'ACTIVE', soc, now())
    ON CONFLICT (phone, "societyId")
      DO UPDATE SET name = EXCLUDED.name, role = 'RESIDENT', status = 'ACTIVE', "updatedAt" = now()
    RETURNING id INTO uid;

    INSERT INTO residents (id, "userId", "flatId", type, "moveInDate", "updatedAt")
    VALUES (gen_random_uuid(), uid, fid, 'OWNER', TIMESTAMP '2023-01-01', now())
    ON CONFLICT ("userId") DO UPDATE SET "flatId" = EXCLUDED."flatId", "updatedAt" = now();
  END LOOP;
END $$;

-- ── Staff ───────────────────────────────────────────────────────────────────
DO $$
DECLARE
  soc  text := 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
  uid  uuid;
  rec  record;
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    ('+911111110001', 'Test Security Guard', 'Security Guard', ARRAY['SECURITY']),
    ('+911111110002', 'Test Housekeeping',   'Housekeeping',   ARRAY['HOUSEKEEPING']),
    ('+911111110003', 'Test Maintenance',    'Maintenance',    ARRAY['PLUMBING','MAINTENANCE']),
    ('+911111110004', 'Test Supervisor',     'Supervisor',     ARRAY['SECURITY'])
  ) AS t(phone, name, designation, cats)
  LOOP
    INSERT INTO users (id, phone, name, role, status, "societyId", "updatedAt")
    VALUES (gen_random_uuid(), rec.phone, rec.name, 'STAFF', 'ACTIVE', soc, now())
    ON CONFLICT (phone, "societyId")
      DO UPDATE SET name = EXCLUDED.name, role = 'STAFF', status = 'ACTIVE', "updatedAt" = now()
    RETURNING id INTO uid;

    INSERT INTO staff_members (id, "userId", "societyId", designation, categories, "joiningDate", "updatedAt")
    VALUES (gen_random_uuid(), uid, soc, rec.designation, rec.cats, TIMESTAMP '2022-06-01', now())
    ON CONFLICT ("userId")
      DO UPDATE SET designation = EXCLUDED.designation, categories = EXCLUDED.categories, "updatedAt" = now();
  END LOOP;
END $$;
