# SocietyOS Staff App — Feature Inventory & Micro-Task Breakdown
> Source of truth: `docs/BRD.pdf` (§4 Staff App, §6.2 Staff User Stories, §3.2.7 Staff Help Requests)
> Last updated: 2026-04-30

---

## Current State: Staff App Screens

| Screen | Route | Backend route | Status |
|---|---|---|---|
| Phone entry | /(auth)/phone-entry | POST /auth/send-otp | ✅ |
| OTP verify | /(auth)/otp-verify | POST /auth/verify-otp | ✅ |
| Home | /(tabs)/index | GET /staff/summary, GET /service-requests/assigned — **SOS CTA may call wrong path** (`/sos/staff` vs `POST /sos/trigger`) | ⚠️ |
| Tasks | /(tabs)/tasks | GET /service-requests/assigned, PATCH status | ✅ |
| Attendance | /(tabs)/attendance | check-in/out, today, month | ✅ |
| Profile | /(tabs)/profile | GET /staff/profile, emergency, salary — **profile photo presign may be missing** | ⚠️ |
| Leave new | /leave/new | POST /staff/leave — **DTO field names may not match** (`leaveType` vs `type`) | ⚠️ |
| Leave history | /leave/history | GET /staff/leaves | ✅ |
| QR scan | /scan/qr | GET /visitors/qr/:token, POST check-in | ✅ |
| Task detail | /tasks/[id] | Mixed: core GET/PATCH on `/service-requests`; photos/notes often on `/staff/tasks/*` — **align clients or add aliases** | ⚠️ |
| Reviews | /reviews | GET /staff/reviews — **pagination shape may differ** (`page` vs `cursor`) | ⚠️ |
| Notice board | /community/notices | GET /staff/community/notices | ✅ |
| Staff messages | /community/messages | groups + messages | ✅ |
| Training | /community/training | GET /staff/community/training | ✅ |
| Recognition | /community/recognition | GET/POST recognition — **`/staff/community/staff-list` may be missing** | ⚠️ |
| Documents | /documents | GET /staff/documents | ✅ |
| Salary slips | /salary | GET /staff/salary | ✅ |
| Help requests | /help-requests | list + detail — **controller may be minimal vs UI** | ⚠️ |

> Last reviewed: 2026-05-01.

---

## BRD-Defined Staff Features (§4, source of truth)

### 4.1 Attendance & Shift Management
- [ ] Daily login/logout with **GPS geofence** validation (society boundary)
- [ ] **Biometric / face-ID** check-in (when device supports it)
- [ ] Shift schedule view: today, this week, upcoming
- [ ] Total hours worked per day, week, month
- [ ] Overtime tracking with admin approval workflow
- [ ] Late-arrival / early-departure flagging with **reason submission**
- [ ] Attendance summary download (CSV/PDF)

### 4.2 Task & Service Request Management
- [ ] List of service requests assigned by admin (plumbing, carpentry, cleaning, etc.)
- [ ] Request detail: resident name, flat, description, photos attached by resident
- [ ] Status transitions: **Accepted → In Progress → Completed**
- [ ] Upload **before / after** photos as proof of work
- [ ] Add notes / comments to a task
- [ ] **Reject** task with reason → escalates to admin
- [ ] Full history of completed tasks
- [ ] Real-time push notification when a new task is assigned

### 4.3 Reviews & Ratings
- [ ] View ratings + reviews received from residents for completed tasks
- [ ] Overall performance score + trend over time
- [ ] Flag inappropriate reviews to admin
- [ ] Notification when a new review is posted
- [ ] Admin-visible performance leaderboard (configurable)

### 4.4 Leave & Holiday Management
- [ ] Apply for leave: types — **casual, medical, privilege**
- [ ] Select leave dates + submit reason
- [ ] Track status: Pending → Approved / Rejected
- [ ] View remaining leave balance **per type**
- [ ] View official society holidays calendar
- [ ] Admin approval workflow for all leave requests
- [ ] Notification on leave approval / rejection

### 4.5 Proof of Work — Photo Upload
- [ ] Upload **multiple photos per task** (before / after / during phases)
- [ ] Photos auto-tagged with **GPS + timestamp**
- [ ] Photos attached to task record visible to admin
- [ ] **Compressed** upload (saves mobile data)
- [ ] Optional **voice note** or text note alongside photos

### 4.6 Staff Community Platform
- [ ] Team announcements from admin / supervisor
- [ ] Staff notice board: policy updates, safety alerts, schedule changes
- [ ] Staff-to-staff messaging (within approved groups)
- [ ] Training materials & how-to guides uploaded by admin
- [ ] Recognition / shoutout board: admin highlights good performers
- [ ] Staff welfare notices (health camps, benefits, etc.)

### 4.7 Staff Profile & Documents
- [ ] View personal profile: name, ID, designation, team
- [ ] Upload + view employment documents (Aadhaar, PAN, contract)
- [ ] View salary slips + payment history
- [ ] Manage emergency contact information

### 4.8 Non-Functional Requirements
- [ ] Android 8.0+ ; lightweight APK **< 30MB** for low-end devices
- [ ] Simple interface with regional language support (Hindi + local languages)
- [ ] **Offline mode** for task viewing; syncs on reconnection
- [ ] **Low data mode**: photo compression; works on 2G / 3G
- [ ] **PIN-based** login + biometric (if device supports)
- [ ] Staff data isolated per community; **RBAC** enforced
- [ ] Large tap targets, high contrast, voice-over (accessibility)

### 3.2.7 Staff Help Requests (incoming from residents)
- [ ] Receive resident help requests: heavy items, document collection, package pickup
- [ ] Real-time status: Requested → Assigned → Completed
- [ ] Resident rates the staff assistance after completion

### 6.2 Staff User Stories
- SS-01 Security Guard — log attendance via app on arrival
- SS-02 Plumber — see assigned service requests for today
- SS-03 Plumber — upload before/after photos of completed repair
- SS-04 Housekeeper — apply for 2 days casual leave
- SS-05 Any Staff — view performance ratings from residents
- SS-06 Any Staff — read notice board for today's updates

---

## 28 Additional Features (Beyond BRD, Enhancing Staff UX)

| # | Feature | Rationale |
|---|---|---|
| 1 | **Task Map View** | Show all today's tasks pinned on a society map → optimise route |
| 2 | **Daily Briefing Card** | Home screen morning summary: today's tasks + shift + weather |
| 3 | **Quick Status Voice Update** | Voice-to-text for status notes (low literacy support) |
| 4 | **Earnings Dashboard** | Month-to-date earnings + projected payout from base salary + overtime |
| 5 | **Task Time Tracker** | Auto-start timer on "In Progress", logs total time per task |
| 6 | **Parts / Materials Checklist** | Pre-task checklist of required tools/materials with photo confirmation |
| 7 | **Resident Quick Call** | One-tap call resident from task detail (masked via Twilio proxy number) |
| 8 | **Geofence Auto Check-In** | Background location: auto-prompt check-in when entering geofence |
| 9 | **Break Tracker** | Start/end break timestamps to support fair shift accounting |
| 10 | **Push Notification Categories** | Per-category toggles (tasks, reviews, leave, announcements) |
| 11 | **Voice/Text Note Toggle** | Universal note dictation across tasks and complaints |
| 12 | **Offline Photo Queue** | Photos captured offline auto-upload when connection restored (BullMQ-style local) |
| 13 | **Performance Heatmap** | Calendar heatmap showing daily completion rate / rating colour-coded |
| 14 | **Goal Progress Bar** | Monthly goals (e.g. 50 tasks / 4.5 avg rating) with progress visualisation |
| 15 | **Shoutout / Kudos Send** | Staff-to-staff peer kudos (admin-moderated) |
| 16 | **Skill Certifications** | Display/upload trade certifications (electrician licence, etc.) |
| 17 | **Inline Translate** | Translate resident-written task descriptions to staff's preferred language |
| 18 | **Issue Photo Annotation** | Draw arrows / circles on photos to highlight problems |
| 19 | **Repeat-Task Templates** | Save common notes as templates ("Replaced O-ring", "Cleaned drain") |
| 20 | **Emergency SOS for Staff** | Staff own SOS button (workplace safety — falls, threats) |
| 21 | **Lost & Found Logger** | Staff log items found at gate/common areas; visible to admin & residents |
| 22 | **Vendor Spend Logger** | Log out-of-pocket spend (parts, fuel) for reimbursement queue |
| 23 | **Task Handover** | Hand a task to another staff with reason (admin-notified) |
| 24 | **Inventory Request** | Request stock replenishment to admin (cleaning supplies, tools) |
| 25 | **Resident Recognition Inbox** | Personal "thank you" notes from residents (non-rating) |
| 26 | **Shift Swap Request** | Propose swap with another staff member; admin approves |
| 27 | **In-App Help Centre** | FAQs + how-to videos for app usage (low digital literacy aid) |
| 28 | **Dark Mode + Large Text Mode** | Accessibility for outdoor / low-vision use |

---

## Schema ↔ Frontend Type Mapping (Critical — staff-app)

### LeaveRequest
| DB field | Frontend type field |
|---|---|
| `type: String` (CASUAL\|MEDICAL\|PRIVILEGE) | `leaveType: LeaveType` |
| `startDate: DateTime` | `fromDate: string` |
| `endDate: DateTime` | `toDate: string` |
| `reason: String` | `reason: string` |
| `status: LeaveStatus` | `status: 'PENDING'\|'APPROVED'\|'REJECTED'` |

### StaffAttendance
| DB field | Frontend type field |
|---|---|
| `checkIn: DateTime` | `checkInAt: string` |
| `checkOut: DateTime` | `checkOutAt: string` |
| `checkInLat / checkInLng` | `checkInGeo: { lat, lng }` |
| `isLate / isEarlyDeparture` | `flags: { late, earlyExit }` |
| `status: AttendanceStatus` | `status: 'PRESENT'\|'ABSENT'\|'LEAVE'\|'HALF_DAY'` |

### StaffReview
| DB field | Frontend type field |
|---|---|
| `rating: Int` | `stars: 1..5` |
| `residentId` | resolved to `reviewer: { name, flat }` |

### ServiceRequest (when shown to assigned staff)
| DB field | Frontend type field |
|---|---|
| `assignedToId` | filtered server-side via `/service-requests/assigned` |
| `ServicePhoto[]` (phase: BEFORE\|AFTER\|DURING) | `photos: { phase, url, lat, lng, takenAt }[]` |
| `ServiceRequestStatus` | `status: 'PENDING'\|'ASSIGNED'\|'IN_PROGRESS'\|'COMPLETED'\|'REJECTED'` |

---

## Solutions-Architect Reverification (against BRD)

| BRD § | Requirement | Coverage in plan | Notes |
|---|---|---|---|
| 4.1 | Geofence check-in | ✅ Agent A backend validates lat/lng vs society polygon; Agent B UI prompts | Society polygon stored in `Society.config.geofence` |
| 4.1 | Biometric / face-ID | ✅ Agent D — `expo-local-authentication` gate before check-in | Optional fallback to PIN |
| 4.1 | Shift schedule | ✅ Agent A creates `Shift` model migration; Agent B UI screen | New model required |
| 4.1 | Overtime + late/early flags | ✅ Existing `isLate` / `isEarlyDeparture`; OT extension via `overtimeMinutes` field |  |
| 4.2 | Task accept/reject + photos + notes | ✅ Agent A backend extends `service-request`; Agent B task detail screen |  |
| 4.3 | Reviews + leaderboard | ✅ Agent A `getReviews(staffId)` + leaderboard endpoint; Agent C UI |  |
| 4.4 | Leave types + balances + holidays | ✅ Agent A `leaveBalance` aggregate + `Holiday` model; Agent C UI |  |
| 4.5 | Geo + timestamp proof photos | ✅ Agent A presigned S3 URLs with metadata; Agent B camera UI captures EXIF |  |
| 4.6 | Community: notices, messaging, training, recognition | ✅ Agent A endpoints; Agent C UI screens |  |
| 4.7 | Profile, documents, salary slips, emergency contact | ✅ Agent D screens; Agent A `/staff/documents`, `/staff/salary` |  |
| 4.8 | Offline + low-data + RBAC + i18n + accessibility | ✅ Agent D — async-storage cache, image-resizer, i18next, large tap targets | APK size to be measured at build |
| 3.2.7 | Staff Help Requests | ✅ Agent A endpoint reuses `service-request` with category=HELP; Agent C UI |  |
| §11 Constraint | APK < 30MB | ⚠️ Tracked at build time — Agent D adds bundle-analyzer script |  |
| §9 Security | RBAC, encrypted PII, OTP login | ✅ Existing JWT + Roles guards; staff role enforced on all endpoints |  |

**Decisions / trade-offs:**
- Voice notes use **expo-audio recording → S3** (no separate transcription service in MVP — can add later).
- Offline mode covers **read-only cache + queued writes** (photos, status changes). True offline DB is Phase 3.
- Staff-to-staff messaging in MVP is **group-only** (no DMs) — admin defines groups; reduces moderation surface.
- Biometric check-in is **device-attested only** (no central biometric DB in MVP — BRD §11 makes hardware-bio optional).

---

## Micro-Task Breakdown by Agent

> **Parallel-safe boundaries:** each agent owns a disjoint set of files. Backend (Agent A) and frontend agents (B, C, D) do not edit the same files. Among frontend agents, screen ownership is exclusive.

---

### Agent A: Backend Staff Domain (50 tasks)
**Scope:** Extend `backend/src/modules/staff/` and add new endpoints. Add Prisma migrations for new models. Register any new modules in `app.module.ts`.

**Files Agent A may touch:**
- `backend/src/modules/staff/*` (all)
- `backend/src/modules/service-request/service-request.service.ts` (extend, do not break)
- `backend/prisma/schema.prisma`
- `backend/src/app.module.ts`
- New: `backend/src/modules/staff-community/*`, `backend/src/modules/help-request/*`

#### Schema migrations (1–8)
1. Add `Holiday` model: `id, societyId, date, name, isOptional, createdAt`
2. Add `Shift` model: `id, staffId, date, startTime, endTime, role, status (SCHEDULED|COMPLETED|MISSED)`
3. Extend `StaffAttendance` with `overtimeMinutes Int @default(0)`, `lateReason String?`, `earlyReason String?`, `breakMinutes Int @default(0)`
4. Add `StaffNotice` model: `id, societyId, title, body, category (POLICY|SAFETY|SCHEDULE|WELFARE), publishedAt, pinnedUntil`
5. Add `StaffMessage` model: `id, societyId, groupId, senderId, body, createdAt`; `StaffMessageGroup` (id, name, memberIds[])
6. Add `TrainingMaterial` model: `id, societyId, title, description, fileUrl, category, createdAt`
7. Add `Recognition` model: `id, societyId, staffId, message, awardedById, createdAt`; `LostFoundItem` model
8. Add `SalarySlip` model: `id, staffId, period (YYYY-MM), grossPay, deductions, netPay, fileUrl, generatedAt`

#### Geofence + biometric check-in (9–13)
9. Add `validateGeofence(societyId, lat, lng): boolean` to `staff.service.ts` reading `society.config.geofence` polygon (point-in-polygon check)
10. Update `checkIn` to call `validateGeofence`; throw 400 if outside
11. Accept `biometricVerified: boolean` and `deviceId: string` on check-in DTO
12. Compute `isLate` from `Shift.startTime` if a Shift row exists for date; else from default 09:00
13. `POST /staff/check-in/late-reason` — submits `lateReason` after a late check-in

#### Shifts & holidays (14–18)
14. `getShifts(staffId, range: 'today'|'week'|'upcoming')` — `Shift.findMany`
15. `GET /staff/shifts?range=` route
16. `getHolidays(societyId, year)` — `Holiday.findMany` for society + year
17. `GET /staff/holidays?year=` route
18. Admin: `POST /admin/holidays` route + service to seed society holidays

#### Tasks/SR extension (19–24)
19. `acceptTask(staffId, requestId)` — set `service_request.status = ASSIGNED → IN_PROGRESS` and `acceptedAt`
20. `rejectTask(staffId, requestId, reason)` — set status `PENDING`, `rejectedReason`, notify admin via Socket.io
21. `addTaskNote(requestId, staffId, body, voiceUrl?)` — append to `task_notes` (new table) or store on SR
22. `getPresignedUploadUrl(requestId, phase: BEFORE|AFTER|DURING)` — returns S3 presigned PUT URL with key
23. `confirmTaskPhoto(requestId, key, phase, lat, lng, takenAt)` — creates `ServicePhoto` row
24. `getMyTaskHistory(staffId, status?, page, pageSize)` — paginated history

#### Reviews + leaderboard (25–28)
25. `getMyReviews(staffId, page)` — `staffReview.findMany` with resident.user join, ordered by `createdAt desc`
26. `getMyPerformance(staffId)` — aggregate `{ avgRating, count, trend30d[], leaderboardRank }`
27. `flagReview(reviewId, staffId, reason)` — adds `flagged=true`, `flagReason`; admin sees in queue
28. `GET /staff/reviews`, `GET /staff/performance`, `POST /staff/reviews/:id/flag` routes

#### Leave balances (29–31)
29. `getLeaveBalance(staffId)` — config-defined annual entitlements per type minus YTD approved leaves; returns `{ casual: { used, total }, medical: ..., privilege: ... }`
30. `GET /staff/leave-balance` route
31. Update `requestLeave` to validate balance > 0 for the requested type before persisting

#### Staff community (32–40)
32. Create `staff-community.module.ts` with controller `/staff/community`
33. `getNotices(societyId)` — `StaffNotice.findMany` ordered by `pinnedUntil desc, publishedAt desc`
34. `GET /staff/community/notices` route
35. `getMyGroups(staffId)` — `StaffMessageGroup.findMany` where `memberIds contains staffId`
36. `getMessages(groupId, staffId, cursor)` — paginated; verifies membership
37. `sendMessage(groupId, staffId, body)` — appends + emits Socket.io `staff:msg:{groupId}`
38. `getTrainingMaterials(societyId, category?)` — list with signed S3 URLs
39. `getRecognitions(societyId, staffId?)` — list, optionally filtered to a staff
40. `GET /staff/community/messages/:groupId`, `POST .../messages/:groupId`, `GET .../training`, `GET .../recognition` routes

#### Profile, documents, salary (41–46)
41. `getMyDocuments(staffId)` — list `Document` where `userId = staff.userId` (reuse generic doc table or create `StaffDocument`)
42. `uploadDocument(staffId)` — returns S3 presigned URL; confirms via metadata callback
43. `getSalarySlips(staffId)` — `SalarySlip.findMany` ordered by period desc
44. `getEmergencyContact(staffId)` / `updateEmergencyContact(staffId, dto)` — store on `StaffMember.emergencyContact JSON`
45. `GET /staff/documents`, `POST /staff/documents` (presigned), `GET /staff/salary`, `GET/PUT /staff/emergency-contact` routes
46. Add `emergencyContact Json?` field to `StaffMember` model + migration

#### Help requests + final cleanup (47–50)
47. Create `help-request.module.ts` reusing `ServiceRequest` with category `HELP_HEAVY|HELP_DOCUMENT|HELP_PACKAGE`. Endpoint `GET /staff/help-requests` returns assigned help requests
48. `POST /staff/help-requests/:id/complete` — sets COMPLETED + emits to resident for rating
49. Register all new modules (`StaffCommunityModule`, `HelpRequestModule`) in `app.module.ts`
50. Run `pnpm prisma migrate dev --name staff_app_extensions`; ensure `pnpm tsc --noEmit` clean in backend

---

### Agent B: Staff App — Attendance, Tasks, Proof of Work (50 tasks)
**Scope:** Enhance attendance + tasks tab and add task detail / camera flow. Use NativeWind for styling. Use `@tanstack/react-query` for data and `zustand` for cross-screen state where needed.

**Files Agent B may touch:**
- `apps/staff-app/app/(tabs)/index.tsx`
- `apps/staff-app/app/(tabs)/tasks.tsx`
- `apps/staff-app/app/(tabs)/attendance.tsx`
- `apps/staff-app/app/scan/qr.tsx`
- New: `apps/staff-app/app/tasks/[id].tsx`, `apps/staff-app/app/tasks/photo-capture.tsx`, `apps/staff-app/app/attendance/shifts.tsx`, `apps/staff-app/app/attendance/late-reason.tsx`
- New: `apps/staff-app/src/components/task/*`, `apps/staff-app/src/components/attendance/*`, `apps/staff-app/src/lib/geo.ts`, `apps/staff-app/src/lib/upload.ts`

**Agent B must NOT touch:** profile.tsx, leave/*, _layout.tsx, settings/*, community/*, reviews/*

#### Home (1–6)
1. Add daily briefing card: today's shift window + tasks pending + outdoor weather emoji (static icon)
2. Add "Tasks today / done / pending" mini-stats row using `summary` query
3. Add quick-action grid: Check In / View Tasks / Apply Leave / My Reviews (link via `router.push`)
4. Add SOS-for-staff floating button at bottom-right that calls `POST /sos/staff` (stub)
5. Add upcoming shift card pulled from `GET /staff/shifts?range=today`
6. Loading skeletons (NativeWind `animate-pulse`) on all home cards

#### Attendance enhancements (7–17)
7. Replace check-in button with Geofence-aware CTA: query `expo-location` GPS, send lat/lng with check-in
8. Show distance-from-society chip ("245 m away — get closer to check in") when outside geofence
9. Add biometric prompt before check-in via `expo-local-authentication`; bypass with PIN if not supported
10. Capture optional selfie via `expo-camera` for check-in (photo URL → presigned S3)
11. Late-reason modal opens automatically if `isLate` flag returns true on check-in response
12. New screen `app/attendance/late-reason.tsx` — text + voice note input → `POST /staff/check-in/late-reason`
13. New screen `app/attendance/shifts.tsx` — list shifts (today/week/upcoming) from `GET /staff/shifts`
14. Shift card: day name, role, time window, status pill (Scheduled/Completed/Missed)
15. Attendance month grid: 7-col calendar with colour cells (green=present, amber=late, red=absent, blue=leave)
16. Tap day → bottom sheet with check-in/out times, geo, OT minutes, photo
17. Add CSV download button → fetches `GET /staff/attendance.csv` (or generates client-side from history JSON)

#### Tasks list (18–24)
18. Add "Map View" tab toggle next to filters → react-native-maps with task pins (defer rendering if no Google key configured — fallback list)
19. Auto-start timer on tap "Start" → store `taskStartedAt[taskId]` in zustand
20. Show elapsed time chip on each in-progress task row
21. Add priority indicator: SLA breach window (red) / at-risk (amber)
22. Pull-to-refresh on tasks list
23. Empty state illustration + "No tasks assigned today"
24. Filter persistence in async-storage so tab restores last filter

#### Task detail screen (25–35)
25. New file `app/tasks/[id].tsx` with header (back, title, status badge)
26. Resident info block: name, flat, masked phone (call button uses `Linking.openURL('tel:...')`)
27. Description block + resident-uploaded photos carousel
28. Status action stack: Accept → In Progress → Completed buttons with confirm modal
29. Reject task button → opens reason modal with required reason text
30. "Add Note" inline — text + microphone (record voice via `expo-audio` → presigned S3 → POST as taskNote)
31. "Capture Photo" CTA opens `app/tasks/photo-capture.tsx`
32. "Materials checklist" template list (replace O-ring, clean drain) — quick-paste into note
33. Inline translate button on resident description (calls a stub `/translate` endpoint — pass-through if missing)
34. Tap any photo to open full-screen viewer with pinch-zoom
35. Bottom action bar always-visible "Mark Completed" CTA when status = IN_PROGRESS

#### Photo capture flow (36–44)
36. New file `app/tasks/photo-capture.tsx` — `expo-camera` view with phase chip selector (Before / During / After)
37. Capture → preview → confirm
38. Auto-stamp timestamp + GPS overlay on the captured frame (drawn via Skia or react-native-view-shot)
39. Compress to max 1200px / 80% JPEG before upload (`expo-image-manipulator`)
40. Request presigned URL via `GET /service-requests/:id/photo-upload-url?phase=` then PUT
41. POST confirmation `POST /service-requests/:id/photos` with key + lat + lng + timestamp
42. Photo annotation tool (draw arrows / circles) using react-native-skia (lazy-loaded)
43. Multi-photo batch capture: shoot up to 5 photos before uploading
44. Offline queue: if network down, store photo locally (`expo-file-system`) + intent in async-storage, retry on reconnect

#### Helpers + polish (45–50)
45. Create `src/lib/geo.ts` — `getCurrentPosition()`, `distanceMeters(a, b)`, `pointInPolygon(point, polygon)`
46. Create `src/lib/upload.ts` — `uploadToPresigned(url, fileUri, contentType)`, `compressImage(uri, opts)`
47. Replace QR scan stub: `app/scan/qr.tsx` reads QR token, calls `GET /visitors/qr/:token`, shows visitor info + "Allow Entry" / "Deny" buttons (security guard flow)
48. Add task time-tracker zustand store `src/store/timer.store.ts`
49. Haptic feedback on accept/complete (`expo-haptics` Heavy)
50. Run `tsc --noEmit` clean in staff-app

---

### Agent C: Staff App — Leave, Reviews, Community (50 tasks)
**Scope:** Build leave balance/holidays, reviews/performance, and full staff community section (notices, messages, training, recognition).

**Files Agent C may touch:**
- `apps/staff-app/app/leave/new.tsx`, `apps/staff-app/app/leave/history.tsx`
- New: `apps/staff-app/app/leave/balance.tsx`, `app/leave/holidays.tsx`
- New: `apps/staff-app/app/reviews/index.tsx`, `app/reviews/performance.tsx`
- New: `apps/staff-app/app/community/_layout.tsx`, `app/community/notices.tsx`, `app/community/messages.tsx`, `app/community/messages/[groupId].tsx`, `app/community/training.tsx`, `app/community/recognition.tsx`
- New: `apps/staff-app/src/components/leave/*`, `src/components/review/*`, `src/components/community/*`

**Agent C must NOT touch:** any tabs/* file, profile.tsx, _layout.tsx, settings/*, tasks/*, attendance/*

#### Leave balance (1–6)
1. New file `app/leave/balance.tsx` — fetch `GET /staff/leave-balance`
2. 3 cards: Casual / Medical / Privilege — each shows `used / total` + progress ring
3. "Apply Now" CTA on each card → navigates to `app/leave/new` with `?type=` prefilled
4. Year selector (current year default) re-fetches balance
5. "Recent leaves" list below cards (last 5)
6. Empty state when no leaves taken

#### Leave new — enhancements (7–11)
7. Add type chips at top (Casual / Medical / Privilege) prefilled from query param
8. Date range picker (from-to) using a lightweight RN datepicker
9. Show estimated days computed live + check against balance ("You will have X left")
10. Reason textarea (required, min 10 chars)
11. Submit shows success modal + toast; navigate back to `/leave/history`

#### Leave history + holidays (12–17)
12. Leave history: filter chips All / Pending / Approved / Rejected
13. Card subtitle shows admin note if rejected
14. New file `app/leave/holidays.tsx` — `GET /staff/holidays?year=`
15. Calendar view (year grid or month list) with holiday markers
16. Toggle "Show optional holidays" filter
17. Today's date highlighted; upcoming holidays count badge in header

#### Reviews (18–25)
18. New file `app/reviews/index.tsx` — `GET /staff/reviews` paginated
19. Header: avg rating big number + 5-star strip + total reviews
20. Review card: stars, comment, reviewer (resident name + flat or "Anonymous"), date
21. Long-press card → "Flag inappropriate" → `POST /staff/reviews/:id/flag` with reason modal
22. Filter chips: All / 5★ / 4★ / 3★ / Negative (≤ 2★)
23. Empty state: "No reviews yet — complete tasks to receive feedback"
24. Pull to refresh + infinite scroll
25. Notification badge on reviews tab when new review received (poll every 30s while screen mounted)

#### Performance (26–30)
26. New file `app/reviews/performance.tsx` — `GET /staff/performance`
27. Trend chart: 30-day average (`react-native-svg` line chart, no Recharts on RN)
28. Stat row: total tasks, avg rating, completion rate %, leaderboard rank ("#3 of 12")
29. Monthly goals card: 50 tasks, 4.5 avg → progress bars
30. "Improve" tip cards (static text — placeholder data)

#### Community shell + notices (31–35)
31. New file `app/community/_layout.tsx` — Stack with header "Community"
32. New file `app/community/notices.tsx` — `GET /staff/community/notices`
33. Notice card: category pill colour-coded (Policy=blue, Safety=red, Schedule=amber, Welfare=green), title, body preview, pinned ribbon if pinned
34. Tap notice → expand to full body + attachments
35. Filter chips by category

#### Messages (36–42)
36. New file `app/community/messages.tsx` — `GET /staff/community/groups` (groups list)
37. Group card: name, member count, last message preview, unread dot
38. New file `app/community/messages/[groupId].tsx` — chat screen
39. Message list (FlatList inverted) with sender name, body, timestamp; bubble colour by sender
40. Composer at bottom: text input + send button (POST `/staff/community/messages/:groupId`)
41. Optimistic UI append; reconcile on response
42. Socket.io listener via shared `src/lib/socket.ts` (create if missing) for `staff:msg:{groupId}` events

#### Training (43–46)
43. New file `app/community/training.tsx` — `GET /staff/community/training`
44. Training card: title, category pill, file type icon (PDF/MP4)
45. Tap to open: PDF via `WebView` (signed URL); video via `expo-video`
46. Search bar + category filter (Onboarding / Safety / Trade / Soft Skills)

#### Recognition (47–50)
47. New file `app/community/recognition.tsx` — `GET /staff/community/recognition`
48. Recognition card: staff photo + name, kudos message, awarded by, date
49. Highlight current user's own recognitions ("You earned this!") on dedicated tab
50. Send Kudos (peer): button → modal → select staff + message → `POST /staff/community/recognition` (admin-moderated)

---

### Agent D: Staff App — Profile, Docs, Settings, Help & Polish (50 tasks)
**Scope:** Profile/documents/salary, settings, help-requests, app shell, accessibility, i18n, offline cache, biometric login, push notifications.

**Files Agent D may touch:**
- `apps/staff-app/app/(tabs)/profile.tsx`
- `apps/staff-app/app/(tabs)/_layout.tsx`
- `apps/staff-app/app/_layout.tsx`
- New: `apps/staff-app/app/documents/index.tsx`, `app/documents/upload.tsx`
- New: `apps/staff-app/app/salary/index.tsx`
- New: `apps/staff-app/app/help-requests/index.tsx`, `app/help-requests/[id].tsx`
- New: `apps/staff-app/app/settings/index.tsx`, `app/settings/notifications.tsx`, `app/settings/language.tsx`, `app/settings/help.tsx`, `app/settings/about.tsx`
- New: `apps/staff-app/app/(auth)/pin-setup.tsx`, `app/(auth)/pin-login.tsx`
- New: `apps/staff-app/src/lib/i18n.ts`, `src/lib/notifications.ts`, `src/lib/offline-queue.ts`, `src/store/settings.store.ts`
- `apps/staff-app/app.json`, `apps/staff-app/package.json`

**Agent D must NOT touch:** tabs/index.tsx, tabs/tasks.tsx, tabs/attendance.tsx, leave/*, tasks/*, attendance/*, scan/*, community/*, reviews/*

#### Profile screen enhancements (1–7)
1. Add photo + edit-photo button (presigned upload to S3 via `POST /staff/profile/photo-url`)
2. Profile detail rows: Designation, Team, Joining Date, Employee ID
3. Earnings card: month-to-date + projected payout (from `/staff/salary` latest)
4. Quick links list: Documents, Salary Slips, Emergency Contact, Settings, Help
5. Emergency contact mini-card with edit button → bottom sheet form
6. Logout button at bottom (existing) + Delete Account link (DPDP compliance) → `POST /auth/delete`
7. App version + "About" footer line

#### Documents (8–13)
8. New file `app/documents/index.tsx` — `GET /staff/documents`
9. Document card: file icon, type label, uploaded date, status pill (Verified / Pending)
10. Tap to preview (PDF in WebView, image full-screen)
11. New file `app/documents/upload.tsx` — pick file via `expo-document-picker` or photo via camera
12. Upload via presigned URL flow (`POST /staff/documents` returns URL → PUT → confirm)
13. Document type chip selector (Aadhaar / PAN / Contract / Certification / Other)

#### Salary (14–17)
14. New file `app/salary/index.tsx` — `GET /staff/salary` paginated by period desc
15. Slip card: month, gross, deductions, net pay, "View PDF" button
16. PDF view via WebView with signed URL
17. Year filter selector + total earned for year footer

#### Help requests inbox (18–23)
18. New file `app/help-requests/index.tsx` — `GET /staff/help-requests`
19. Group by status: Active / Completed
20. Card: type icon (Heavy / Document / Package), resident name + flat, requested time
21. Tap card → `app/help-requests/[id].tsx` detail
22. Detail: same status flow as task (Accept → In Progress → Completed)
23. "Mark Complete" hits `POST /staff/help-requests/:id/complete`

#### Settings (24–32)
24. New file `app/settings/index.tsx` — list: Notifications, Language, Theme, Data Saver, Biometric, Help, About
25. New file `app/settings/notifications.tsx` — per-category toggles (Tasks, Reviews, Leave, Announcements, Help Requests) saved in zustand `settings.store`
26. New file `app/settings/language.tsx` — picker: English, Hindi, Kannada, Tamil, Marathi
27. Theme toggle: System / Light / Dark + Large Text mode toggle
28. Data Saver toggle: when on, image-manipulator compresses more aggressively + disables auto-image-load
29. Biometric login toggle (gate via `expo-local-authentication.canAuthenticateAsync`)
30. New file `app/settings/help.tsx` — FAQ accordion list (10 hard-coded entries)
31. New file `app/settings/about.tsx` — version, build, ToS link, Privacy Policy link, Open Source licences
32. Settings persisted via `expo-secure-store` for biometric flag + async-storage for the rest

#### i18n (33–37)
33. New file `src/lib/i18n.ts` — set up `i18next` + `react-i18next` with namespaces
34. Add `src/locales/en.json`, `hi.json`, `kn.json`, `ta.json`, `mr.json` (seed with ~30 common keys)
35. Wrap `_layout.tsx` root with `I18nextProvider`
36. Replace hard-coded strings in profile + settings screens with `t('key')`
37. Language change immediately re-renders (no app restart) — verify by toggling

#### Offline + low-data (38–41)
38. New file `src/lib/offline-queue.ts` — generic queue: enqueue request, persist to async-storage, drain on `NetInfo` online event
39. Wrap mutation client (or hook into ApiClient) so offline writes get queued
40. Disable image auto-load when Data Saver on; show "Tap to load" placeholder
41. Cache `GET /staff/summary`, `GET /service-requests/assigned`, `GET /staff/shifts` via React Query persistence (`@tanstack/react-query-persist-client`)

#### Auth (42–45)
42. New file `app/(auth)/pin-setup.tsx` — first-time 4-digit PIN setup, stored hashed in `expo-secure-store`
43. New file `app/(auth)/pin-login.tsx` — PIN entry shown on cold start if biometric off (or fallback)
44. On app start in `_layout.tsx`: check biometric pref → prompt biometric → fallback to PIN → fallback to OTP
45. Auto-lock after 5 min idle (settings-configurable)

#### Push notifications + tab shell (46–50)
46. New file `src/lib/notifications.ts` — register FCM token via `expo-notifications`, send to `POST /staff/devices` (stub if missing)
47. Foreground notification handler: route to relevant screen on tap (task → tasks/[id], review → reviews, leave → leave/balance)
48. Update `app/(tabs)/_layout.tsx` — keep 4 tabs (Home, Tasks, Attendance, Profile); add badge counts (pending tasks, unread reviews) using zustand-derived state — do not edit tab screens themselves
49. Loading shell: `app/_layout.tsx` shows splash until auth + i18n ready
50. Run `tsc --noEmit` clean in staff-app; verify APK build size < 30MB target via `npx expo export` size report (manual gate)

---

## File Map

```
backend/
  prisma/schema.prisma                                    # Agent A
  src/modules/staff/staff.{controller,service}.ts         # Agent A
  src/modules/staff-community/                            # Agent A (new)
  src/modules/help-request/                               # Agent A (new)
  src/modules/service-request/service-request.service.ts  # Agent A (extend)
  src/app.module.ts                                       # Agent A

apps/staff-app/
  app/(tabs)/index.tsx                                    # Agent B
  app/(tabs)/tasks.tsx                                    # Agent B
  app/(tabs)/attendance.tsx                               # Agent B
  app/(tabs)/profile.tsx                                  # Agent D
  app/(tabs)/_layout.tsx                                  # Agent D
  app/_layout.tsx                                         # Agent D
  app/(auth)/                                             # Agent D (pin-setup, pin-login new)
  app/scan/qr.tsx                                         # Agent B
  app/tasks/                                              # Agent B (new)
  app/attendance/                                         # Agent B (new)
  app/leave/                                              # Agent C
  app/reviews/                                            # Agent C (new)
  app/community/                                          # Agent C (new)
  app/documents/                                          # Agent D (new)
  app/salary/                                             # Agent D (new)
  app/help-requests/                                      # Agent D (new)
  app/settings/                                           # Agent D (new)
  src/components/task/                                    # Agent B
  src/components/attendance/                              # Agent B
  src/components/leave/                                   # Agent C
  src/components/review/                                  # Agent C
  src/components/community/                               # Agent C
  src/lib/geo.ts, upload.ts                               # Agent B
  src/lib/i18n.ts, notifications.ts, offline-queue.ts     # Agent D
  src/store/timer.store.ts                                # Agent B
  src/store/settings.store.ts                             # Agent D
  src/locales/                                            # Agent D
```

---

## Conflict avoidance summary

| File | Owner | Reason |
|---|---|---|
| `tabs/_layout.tsx` | Agent D | Shell ownership; B/C add new routes outside tabs |
| `tabs/index.tsx`, `tasks.tsx`, `attendance.tsx` | Agent B | B owns task/attendance UX |
| `tabs/profile.tsx` | Agent D | Profile/docs/settings cluster |
| `app/_layout.tsx` | Agent D | Root i18n + auth gating |
| `package.json` | Agent D | Adds i18next, react-i18next, image-manipulator, document-picker, local-authentication, notifications, react-native-svg, audio, file-system, view-shot, skia, datepicker (Agents B/C use these but DO NOT edit package.json — Agent D adds them all upfront in tasks 33, 38, 46) |
| `prisma/schema.prisma` | Agent A | Single source of schema truth |
| `app.module.ts` | Agent A | Single module-registration point |

If Agents B or C find a missing dependency they need, they MUST add it themselves only as a last resort (Agent D batches all known deps) — and prefer using already-installed packages (`expo-camera`, `expo-haptics`, `expo-secure-store`, `@expo/vector-icons`, `nativewind`, `react-query`, `zustand` are already in package.json).
