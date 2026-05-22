# SocietyOS Admin Portal — Feature Inventory & Micro-Task Breakdown
> Source of truth: `docs/BRD.pdf` (§5 Admin Portal, §6.3 Admin User Stories)
> Last updated: 2026-05-01

---

## Current State: Admin Web Pages

| Page | Route | Backend route | Status |
|---|---|---|---|
| Dashboard | /dashboard | GET /admin/dashboard/stats, financial, activity, events, pending residents, service-requests, /sos/active | ✅ Connected (see `admin.controller.ts`) |
| Residents | /residents | GET /admin/residents, pending, approve/reject | ✅ Partial — detail derives from list, no `GET :id` |
| Staff | /staff | GET /admin/staff, leaves approve/reject | ✅ Partial — attendance log / perf reports thin |
| Visitors | /visitors | GET /admin/visitors, check-in/out | ✅ |
| Service Requests | /service-requests | GET /service-requests, assign, status | ✅ |
| Complaints | /complaints | Admin list + status; detail may call `GET /admin/complaints/:id` — verify deploy | ⚠️ Verify contract |
| Maintenance | /maintenance | GET /admin/maintenance/bills, remind, generate | ✅ Partial |
| Notices | /notices | GET/POST /notices | ✅ |
| Events | /events | GET /events, admin create/cancel/attendees — confirm PATCH/feedback/notify | ⚠️ Partial |
| SOS Alerts | /sos | GET /sos/active, ack/resolve, /admin/sos/log | ✅ Partial — config UI may be thin |

> Last full review: 2026-05-01. Older ❌ markers below in BRD checklist are being retired in favor of this table + `implementation-plan.md` “Verified as-built status”.

---

## BRD-Defined Admin Features (§5, source of truth)

### 5.1 Dashboard & Analytics
- [ ] Stat cards: total residents, active complaints, pending SRs, upcoming events, today's attendance
- [ ] Financial snapshot: dues collected, outstanding maintenance, recent transactions
- [ ] Activity feed: real-time latest events across all modules
- [ ] Quick actions: post notice, create event, approve request, send alert
- [ ] Trend charts: complaint resolution time, service ratings, canteen usage, payment compliance %

### 5.2 Resident Management
- [ ] Onboard residents: link to flat, verify identity, set tenant/owner type
- [ ] View resident activity, payment history, complaint history (detail drawer)
- [ ] Deactivate accounts (vacated/sold flats)
- [ ] Bulk message to selected residents or all
- [ ] Export resident directory (CSV)
- [ ] Pending approval queue (approve/reject new residents)

### 5.3 Staff Management
- [ ] Add, edit, deactivate staff profiles
- [ ] Assign staff to service categories
- [ ] Real-time attendance log view
- [x] Approve/reject leave requests — **backend:** `PATCH /admin/leaves/:id/approve|reject` + society scoping (`admin.service.ts`, `admin.controller.ts`); UI on staff page
- [ ] Assign tasks to specific staff
- [ ] Staff performance report (ratings, task completion %, attendance %)
- [ ] Salary structure view
- [ ] Staff document upload/view

### 5.4 Service Request Management
- [ ] Priority queue view (all incoming SRs)
- [ ] One-click staff assignment
- [ ] Status tracking (Open → Assigned → In Progress → Completed → Disputed)
- [ ] SLA configuration per category
- [ ] SLA breach alerts
- [ ] View request photos and completion proofs
- [ ] Dispute resolution
- [ ] Export SR reports (CSV, date range, category, staff)

### 5.5 Canteen Management
- [ ] Create/update daily menu (Breakfast, Lunch, Snacks, Dinner)
- [ ] Weekly menu grid editor (7 days × 4 meal types)
- [ ] Dish detail: name, price, calories, allergens, isVeg
- [ ] View meal ratings & resident feedback
- [ ] Most/least popular dishes analytics
- [ ] Pre-order slot management

### 5.6 Event Management
- [x] Create, edit, cancel events — cancel path wired: `PATCH /admin/events/:id/cancel` → `EventService.cancelEvent` (`event.controller.ts`, `event.service.ts`)
- [ ] Registration limits + waitlist management
- [ ] Attendee list with flat numbers
- [ ] Send event-specific notifications to registrants
- [ ] Post-event feedback & ratings view
- [ ] Export event reports (CSV)

### 5.7 Medical Module Administration
- [ ] Medical staff list (doctors, nurses, visiting schedule)
- [ ] Add/edit/remove medical staff
- [ ] Appointment slot configuration per doctor
- [ ] SOS alerts log with response times
- [ ] Configure SOS alert recipients
- [ ] Appointment booking records view

### 5.8 Complaints Administration
- [ ] All complaints view with status/category/priority filter (partial ✅ UI, ❌ backend)
- [ ] Assign complaint to staff/committee member
- [ ] Status update + resolution notes
- [ ] Escalation rules & SLA configuration per category
- [ ] Complaint trend analytics
- [ ] Complaint resolution reports (CSV)

### 5.9 Financial Management
- [ ] Maintenance charge configuration (base, parking, water, penalty rates)
- [ ] Itemised billing setup per flat type
- [ ] Payments overview: received / pending / overdue tabs (**UI** may exist; **aggregate API** fidelity — verify against `GET /admin/maintenance/bills` + financial snapshot)
- [x] Send payment reminders — **`POST /admin/maintenance/bills/:id/remind`** sends via `PushService` / FCM when token + prefs allow (`admin.service.ts` `sendPaymentReminder`); not SMS
- [ ] Generate bills for all units for a period (bulk generation)
- [ ] Financial reports: collection summary, outstanding dues, ledger (CSV/PDF)
- [ ] Accounting export (Tally XML / Excel)
- [ ] Refund approval and processing

### 5.10 Property & Travel Management
- [ ] Property sale listings queue (approve/reject)
- [ ] Community property board (approved listings)
- [ ] Buyer-seller introduction facilitation
- [ ] Travel pause requests queue (approve/reject)
- [ ] Active travel pauses tracker with return dates
- [ ] Billing adjustment for residents on travel pause

### 5.11 Notices, Polls & Communication
- [ ] Post notices (partial ✅ UI + backend, needs target audience filter)
- [ ] Create polls + real-time results (pie/bar chart)
- [ ] Targeted push notification composer
- [ ] Schedule notifications for future delivery
- [ ] Communication archive (all notices/notifications searchable)

---

## 20+ Additional Features (Beyond BRD, Enhancing Admin UX)

| # | Feature | Rationale |
|---|---|---|
| 1 | **Audit Log Viewer** | BRD §5.12 mandates audit trail — needs UI; shows who did what |
| 2 | **Society Settings & Config** | Feature flags (telehealth on/off, canteen on/off), society info, logo |
| 3 | **Role-Based Access UI** | BRD §5.12: Super Admin, Manager, Finance Admin, Canteen Admin, Medical Admin — needs management UI |
| 4 | **Staff Attendance Heatmap** | Monthly calendar with colour-coded presence/absence/late |
| 5 | **Bulk Bill Generation** | Auto-generate bills for all flats for a selected month |
| 6 | **SLA Configuration Panel** | Visual UI to set SLA days per service/complaint category |
| 7 | **Service Catalog Management** | Admin controls which services appear in resident app |
| 8 | **Event Waitlist Promotion** | When attendee cancels, auto-promote from waitlist with notification |
| 9 | **Financial Dashboard Charts** | Collection rate trend (line), outstanding by block (bar), via Recharts |
| 10 | **CSV/PDF Export on every table** | One-click export button on all list views |
| 11 | **Resident Approval Workflow** | Dedicated tab: pending residents → verify flat → approve/reject |
| 12 | **Push Notification Composer** | Target: ALL / block / resident-type / individual; preview before send |
| 13 | **Real-time Activity Feed** | Live stream: visitor checkins, SOS triggers, new complaints (Socket.io) |
| 14 | **Inline Staff Assignment** | On SR detail view: assign to staff via dropdown without leaving page |
| 15 | **Complaint Escalation Config** | Visual rule builder: "if unresolved after N days in status X, escalate" |
| 16 | **Canteen Weekly Grid Editor** | 7-col × 4-row editable grid (drag-drop or inline edit per cell) |
| 17 | **Medical Staff Schedule Builder** | Visual availability picker: days of week + time slot matrix |
| 18 | **Poll Results Dashboard** | Live vote counts, percentage breakdown, voter list (if non-anonymous) |
| 19 | **Property Listing Board** | Admin-facing kanban: Under Review / Approved / Listed / Sold |
| 20 | **Travel Pause Billing UI** | One-click activate/deactivate pause, shows adjusted bill preview |
| 21 | **Staff Payroll Summary** | Monthly salary disbursement view, attendance-based deductions |
| 22 | **Global Search** | Header search bar: residents, staff, SRs, complaints by name/flat/ID |
| 23 | **Notification Center** | In-app bell icon with unread count, feed of recent admin-relevant events |
| 24 | **Dark Mode** | System-preference-aware theme toggle |
| 25 | **Multi-Society Switcher** | Super-admin: dropdown to switch between societies without re-login |

---

## Schema ↔ Frontend Type Mapping (Critical for backend)

### LeaveRequest
| DB field | Frontend type field |
|---|---|
| `type: String` | `leaveType: LeaveType` |
| `startDate: DateTime` | `fromDate: string` |
| `endDate: DateTime` | `toDate: string` |

### MaintenanceBill
| DB field | Frontend type field |
|---|---|
| `total: Decimal` | `amount: number` |
| `PaymentStatus.SUCCESS` | `'PAID'` |
| `PaymentStatus.PENDING` | `'PENDING'` |
| `PaymentStatus.FAILED` | `'OVERDUE'` |
| *(no month/year fields)* | parsed from `period: String` (format `"YYYY-MM"`) |

### Visitor
| DB field | Frontend type field |
|---|---|
| `validUntil: DateTime` | `validTill: string` |
| `entryAt: DateTime` | `checkedInAt: string` |
| `exitAt: DateTime` | `checkedOutAt: string` |
| `vehicleNo: String` | `vehicleNumber: string` |
| `status EXPECTED` | maps to frontend `PENDING` |

### Event (DB has no `category` or `endAt`)
| DB field | Frontend type field |
|---|---|
| `date: DateTime` | `startAt: string` |
| `capacity: Int` | `maxAttendees: number` |
| `_count.registrations` | `registeredCount: number` |
| *(no category)* | return `'OTHER'` as default until migration |
| *(no endAt)* | return `date + 2h` as default until migration |

### StaffMember
| DB field | Frontend type field |
|---|---|
| `designation: String` | `role: string` (frontend calls it role) |
| `staffMember.user.name` | `name: string` |
| `staffMember.user.phone` | `phone: string` |
| `staffMember.categories` | *(extra, not in type yet)* |

---

## Micro-Task Breakdown by Agent

---

### Agent A: Backend Admin Module (50 tasks)
**Scope:** Create `backend/src/modules/admin/` with all `/admin/*` routes. Fix `EventService.cancelEvent`. Register in `app.module.ts`. Fix service-requests page URL.

#### Admin Module Core (tasks 1-10)
1. Create dir `backend/src/modules/admin/`
2. Create `admin.module.ts` importing `PrismaModule`
3. Create `admin.service.ts` with `PrismaService` injected
4. Create `admin.controller.ts` with `@Controller('admin')`, `@ApiTags('admin')`, `@ApiBearerAuth()`, `@UseGuards(JwtAuthGuard, RolesGuard)`
5. Apply `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` at class level on controller
6. Register `AdminModule` in `backend/src/app.module.ts`
7. Add `cancelEvent(id: string)` to `EventService` — sets status to `CANCELLED`
8. Fix `EventController` `@Patch(':id/cancel')` to properly call `eventService.cancelEvent(id)`
9. Fix `apps/admin-web/src/app/service-requests/page.tsx` URL: `/service-requests/society` → `/service-requests`

#### Dashboard Stats (tasks 10-15)
10. `getDashboardStats(societyId)` — parallel `Promise.all`: count active residents, pending SRs, open complaints, upcoming events, today's visitor checkins, overdue bills, active SOS alerts, flats/occupied for occupancy rate
11. `GET /admin/dashboard/stats` route — `@SocietyId()` param

#### Residents (tasks 12-15)
12. `getResidents(societyId)` — `prisma.resident.findMany` with `user` + `flat` joins, map to `{ id, name: r.user.name, phone: r.user.phone, status: r.user.status, unit: { flatNumber: flat.number, tower: flat.block }, createdAt: r.createdAt }`
13. `GET /admin/residents` route
14. `approveResident(userId)` — update `user.status = ACTIVE`
15. `PATCH /admin/residents/:id/approve` route

#### Staff & Leaves (tasks 16-24)
16. `getStaff(societyId)` — `staffMember.findMany` with `user` join, map to `{ id: sm.id, name: sm.user.name, phone: sm.user.phone, role: sm.designation, department: sm.categories[0] ?? null, societyId, createdAt: sm.user.createdAt }`
17. `GET /admin/staff` route
18. `getLeaves(societyId, status?)` — `leaveRequest.findMany` filtered by status if provided, include `staff.user`, map `type→leaveType`, `startDate→fromDate`, `endDate→toDate`, attach `staff: { name, role: designation }`
19. `GET /admin/leaves` route (query param `?status=PENDING`)
20. `approveLeave(leaveId, adminNote?)` — `leaveRequest.update` status APPROVED
21. `PATCH /admin/leaves/:id/approve` route
22. `rejectLeave(leaveId, adminNote?)` — `leaveRequest.update` status REJECTED
23. `PATCH /admin/leaves/:id/reject` route (body: `{ adminNote? }`)
24. Add societyId scoping to leave queries via `staff.societyId`

#### Visitors (tasks 25-28)
25. `getVisitors(societyId)` — `visitor.findMany` with `resident.user` + `resident.flat` join, map `validUntil→validTill`, `entryAt→checkedInAt`, `exitAt→checkedOutAt`, `vehicleNo→vehicleNumber`, `EXPECTED→PENDING`, attach `resident: { name, unit: { flatNumber } }`
26. `GET /admin/visitors` route — scope by querying residents of societyId
27. `GET /admin/visitors?status=` filter support
28. `GET /admin/visitors?date=today` support (filter by createdAt)

#### Complaints (tasks 29-32)
29. `getComplaints(societyId, status?)` — `complaint.findMany` with `resident.user` join, filtered by status
30. `GET /admin/complaints` route (query: `?status=`)
31. `updateComplaintStatus(id, status, adminNote?)` — update complaint
32. `PATCH /admin/complaints/:id/status` route (body: `{ status, adminNote? }`)

#### Maintenance (tasks 33-38)
33. `getMaintenanceBills(societyId, year, month)` — parse `period` field (format `"YYYY-MM"`), filter, include `resident.user` + `flat`, map `total→amount` (Number()), map PaymentStatus: `SUCCESS→PAID`, `FAILED→OVERDUE`, `PENDING→PENDING`, `REFUNDED→PAID`
34. `GET /admin/maintenance/bills` route (query: `?year=&month=`)
35. `sendPaymentReminder(billId)` — find bill+resident, log intent (FCM stub: just return `{ sent: true }` for now)
36. `POST /admin/maintenance/bills/:id/remind` route
37. `generateBills(societyId, year, month)` — create `MaintenanceBill` records for all flats without a bill for that period
38. `POST /admin/maintenance/bills/generate` route (body: `{ year, month }`)

#### Events (tasks 39-45)
39. `getAdminEvents(societyId)` — all statuses, include `_count.registrations`, map `date→startAt`, `capacity→maxAttendees`, `_count.registrations→registeredCount`, add `category: 'OTHER'`, add `endAt: new Date(date.getTime() + 2*3600000).toISOString()`
40. `GET /admin/events` route
41. `createEvent(societyId, dto)` — map `startAt→date`, `maxAttendees→capacity`, set status `PUBLISHED`
42. `POST /admin/events` route (body: `{ title, description, category, startAt, endAt, venue, maxAttendees? }`)
43. `cancelEventAdmin(societyId, id)` — update event status to CANCELLED (uses new `EventService.cancelEvent`)
44. `PATCH /admin/events/:id/cancel` route
45. `getEventAttendees(eventId)` — `eventRegistration.findMany` with `resident.user` + `resident.flat`, return list
46. `GET /admin/events/:id/attendees` route

#### Final cleanup (tasks 47-50)
47. Add proper `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` to every route (or class-level)
48. Add `@HttpCode(HttpStatus.OK)` where needed
49. Verify all imports compile (no missing imports)
50. Run `tsc --noEmit` in backend and fix any type errors

---

### Agent B: Backend Domain Extensions (50 tasks)
**Scope:** Add admin endpoints to existing canteen, medical, notice/poll, property, travel modules. No changes to app.module.ts (all these modules are already registered).

#### Canteen Admin (tasks 1-15)
1. Read `backend/src/modules/canteen/canteen.service.ts` and `canteen.controller.ts`
2. Add `createMenu(societyId, dto)` to canteen service — create `CanteenMenu` with dishes
3. Add `updateMenu(menuId, dto)` — upsert dishes
4. Add `deleteMenu(menuId)` — remove menu + cascade dishes
5. Add `addDish(menuId, dto)` — add single dish
6. Add `updateDish(dishId, dto)` — update dish fields
7. Add `deleteDish(dishId)` — remove dish
8. Add `getMenuAnalytics(societyId)` — group dishes by rating (via separate dish rating model or canteen orders if exists), return top/bottom 5
9. Add `POST /admin/canteen/menus` route (body: `{ date, mealType, dishes[] }`)
10. Add `PUT /admin/canteen/menus/:id` route
11. Add `DELETE /admin/canteen/menus/:id` route
12. Add `POST /admin/canteen/menus/:id/dishes` route
13. Add `PUT /admin/canteen/dishes/:id` route
14. Add `DELETE /admin/canteen/dishes/:id` route
15. Add `GET /admin/canteen/analytics` route

#### Medical Admin (tasks 16-28)
16. Read `backend/src/modules/medical/medical.service.ts` and `medical.controller.ts`
17. Add `createMedicalStaff(societyId, dto)` — create `MedicalStaff` record
18. Add `updateMedicalStaff(id, dto)` — update schedule/availability
19. Add `deleteMedicalStaff(id)` — soft delete (set `isAvailable: false`)
20. Add `getAppointments(societyId, date?, doctorId?)` — admin view of all appointments
21. Add `getSosLog(societyId)` — all SOS alerts for society with resident info
22. Add `updateSosConfig(societyId, config)` — store alert recipient config in `Society.config` JSON
23. Add `POST /admin/medical/staff` route
24. Add `PUT /admin/medical/staff/:id` route
25. Add `DELETE /admin/medical/staff/:id` route
26. Add `GET /admin/medical/appointments` route (query: `?date=&doctorId=`)
27. Add `GET /admin/sos/log` route (all SOS, all statuses, with resident info)
28. Add `PUT /admin/sos/config` route

#### Polls (tasks 29-36)
29. Read `backend/src/modules/notice/notice.service.ts` (polls may be there or standalone)
30. Add `createPoll(societyId, dto)` — create `Poll` with options JSON
31. Add `getPollResults(pollId)` — aggregate `PollVote` by option, return counts + percentages
32. Add `getPolls(societyId)` — list all polls with vote counts
33. Add `closePoll(pollId)` — set deadline to now (effectively closes voting)
34. Add `POST /admin/polls` route (body: `{ question, options[], deadline, isAnonymous }`)
35. Add `GET /admin/polls` route
36. Add `GET /admin/polls/:id/results` route
37. Add `PATCH /admin/polls/:id/close` route

#### Property & Travel Admin (tasks 37-44)
38. Read `backend/src/modules/` for property and travel modules — check if they exist or if endpoints are in resident module
39. Add `getPropertyListings(societyId, status?)` — with resident + flat info
40. Add `approvePropertyListing(id)` — update status to ACTIVE
41. Add `rejectPropertyListing(id, reason?)` — update status to WITHDRAWN
42. Add `GET /admin/property/listings` route (query: `?status=`)
43. Add `PATCH /admin/property/listings/:id/approve` route
44. Add `PATCH /admin/property/listings/:id/reject` route

#### Travel Pause Admin (tasks 45-50)
45. Add `getTravelPauses(societyId, status?)` — with resident + flat info
46. Add `approveTravelPause(id)` — update status to ACTIVE
47. Add `rejectTravelPause(id)` — update status to CANCELLED
48. Add `GET /admin/travel/pauses` route (query: `?status=`)
49. Add `PATCH /admin/travel/pauses/:id/approve` route
50. Add `PATCH /admin/travel/pauses/:id/reject` route

---

### Agent C: Admin Web — New Feature Pages (50 tasks)
**Scope:** Create 6 new admin pages + update Sidebar. All pages follow the same UI pattern as existing pages (bg-white rounded-2xl shadow-sm border border-gray-100).

**Design system:** Primary color `primary-500` (#3B3FBF), Tailwind only, rounded-2xl cards, `cn()` from `@/lib/cn`.

#### Sidebar (tasks 1-3)
1. Add canteen, medical, polls, property, travel, settings nav items to `Sidebar.tsx`
2. Use icons: 🍽️ Canteen, 🏥 Medical, 📊 Polls, 🏢 Property, ✈️ Travel, ⚙️ Settings
3. Add section dividers: "Operations" group (canteen, medical), "Community" group (polls, property, travel), "Admin" group (settings)

#### Canteen Management Page (tasks 4-13)
4. Create `apps/admin-web/src/app/canteen/layout.tsx` (copy dashboard layout pattern)
5. Create `apps/admin-web/src/app/canteen/page.tsx`
6. Date picker to select day (prev/next day navigation)
7. 4 meal type tabs: Breakfast / Lunch / Snacks / Dinner
8. List dishes for selected day + meal type from `GET /canteen/menu?date=&societyId=`
9. "Add Dish" form: name, price, calories, allergens, isVeg toggle
10. Inline edit dish (click row to expand edit form)
11. Delete dish button with confirmation
12. Weekly view toggle: 7-column grid showing meal counts per day
13. Popular dishes section: top 5 rated dishes from analytics endpoint

#### Medical Admin Page (tasks 14-22)
14. Create `apps/admin-web/src/app/medical/layout.tsx`
15. Create `apps/admin-web/src/app/medical/page.tsx` with 3 tabs: Doctors, Appointments, SOS Log
16. Doctors tab: list of `MedicalStaff` with name, designation, availability status
17. Add Doctor modal: name, designation, available days (multi-select), time slots input
18. Edit Doctor: same modal pre-filled
19. Appointments tab: table of all appointments with resident, doctor, date, slot, status
20. Appointments filter: by date, by doctor, by status
21. SOS Log tab: table of all SOS alerts with resident, flat, time, response time, status
22. SOS config: designate alert recipients (list of phone numbers, save to society config)

#### Polls Page (tasks 23-30)
23. Create `apps/admin-web/src/app/polls/layout.tsx`
24. Create `apps/admin-web/src/app/polls/page.tsx`
25. Polls list: shows question, deadline, total votes, status (active/closed)
26. Create Poll form: question, options (dynamic add/remove), deadline datepicker, anonymous toggle
27. Poll detail: live results with bar chart (Recharts `BarChart`) showing option vs vote count
28. Vote percentage labels on each bar
29. Close poll action (sets deadline to now)
30. Voter list (if non-anonymous): expandable section showing who voted

#### Property & Travel Page (tasks 31-40)
31. Create `apps/admin-web/src/app/property/layout.tsx`
32. Create `apps/admin-web/src/app/property/page.tsx` with 2 tabs: Property Listings, Travel Pauses
33. Property listings tab: table with flat, resident, asking price, status, submitted date
34. Approve/Reject buttons per listing row
35. Listing detail: expand row to show description, photos (if any), contact info
36. Travel pauses tab: table with resident, flat, travel dates, return date, status
37. Approve/Reject buttons per pause row
38. Show adjusted billing info (if available) per pause
39. "Returning today" badge on pauses with returnDate = today
40. Filter tabs: Pending / Active / Completed

#### Settings Page (tasks 41-50)
41. Create `apps/admin-web/src/app/settings/layout.tsx`
42. Create `apps/admin-web/src/app/settings/page.tsx` with 4 sections: Society Info, Feature Flags, Billing Config, SOS Config
43. Society Info section: name, address, city, pincode (read-only display for now)
44. Feature Flags section: toggles for Canteen, Events, Medical, Canteen Pre-orders, Telehealth, Property Listings, Travel Pause
45. Billing Config section: base maintenance per flat type, parking charges, water charges, penalty per day
46. SOS Config section: add/remove emergency contact phone numbers with labels (Medical, Security, Admin)
47. Save button per section with loading state
48. Success toast notification on save
49. "Coming Soon" badge on features not yet implemented
50. Admin roles section: display current admin's role and capabilities

---

### Agent D: Admin Web — Dashboard & Existing Page Enhancements (50 tasks)
**Scope:** Enhance existing 10 pages with charts, better UX, new flows. Do NOT modify Sidebar.tsx (Agent C owns that).

#### Dashboard Enhancements (tasks 1-18)
1. Install `recharts` if not already in `apps/admin-web/package.json`
2. Add `AreaChart` (Recharts) for "Payment Compliance % last 6 months" to dashboard
3. Add `BarChart` for "Complaints by Category" (top 5 categories)
4. Add `LineChart` for "Service Requests this month" (day-by-day)
5. Fetch chart data from new stats endpoint (or mock with static data if endpoint not ready)
6. "Quick Actions" row: 4 buttons — Post Notice, Create Event, Send Alert, Generate Bills — linking to respective pages
7. Activity feed section: list of 10 recent events (visitor checkins, new SRs, SOS, complaints) from new `/admin/activity` endpoint (or aggregate from existing)
8. Make stat cards clickable — navigate to relevant page on click
9. Add loading skeleton animation on stat cards (CSS pulse)
10. Add `refetchInterval: 30_000` to stats query for live updates
11. Add financial snapshot row: "Collected This Month" + "Outstanding" + "Overdue count"
12. Fetch financial data from maintenance bills endpoint aggregated
13. Add "Today's Attendance" card showing staff checked-in count
14. Add upcoming events card showing next 3 events
15. Make SOS banner persist via `localStorage` dismissal until resolved
16. Add date display in IST timezone
17. Responsive: ensure 2-col on mobile, 4-col on desktop for stat grid
18. Add `<Suspense>` boundaries with skeleton fallbacks

#### Residents Page Enhancements (tasks 19-24)
19. Add "Pending Approval" tab alongside the main table (residents with `status = PENDING`)
20. Pending tab: show flat assignment input + Approve / Reject buttons per resident
21. `PATCH /admin/residents/:id/approve` mutation on approve
22. Resident count badge on "Pending" tab showing pending count
23. Add "Export CSV" button downloading resident directory
24. Add Status filter dropdown (Active, Pending, Inactive)

#### Staff Page Enhancements (tasks 25-30)
25. Add attendance section below leave requests: calendar heatmap for current month
26. Staff row: make clickable to expand staff detail panel (designation, categories, joining date)
27. Add "Add Staff" button placeholder (shows "Coming Soon" modal)
28. Leave request: show staff role in the leave card subtitle
29. Add date range badge on leave card (N days)
30. Add filter tabs to leave section: All / Pending / Approved / Rejected

#### Service Requests Enhancements (tasks 31-35)
31. Add staff assignment dropdown in SR row expand panel — calls `PATCH /service-requests/:id/assign`
32. Add priority indicator: requests > 48h old get amber badge, > 96h get red badge
33. Add photo viewer modal for requests that have photos
34. Add "Export CSV" button for current filtered view
35. SR count badge in filter tabs

#### Complaints Enhancements (tasks 36-39)
36. Add assignee field in complaint detail expand panel
37. Add resolution notes textarea shown when moving to RESOLVED
38. Add complaint trend mini-chart (last 30 days, line chart) at top of page
39. Complaint count badges on filter tabs

#### Events Enhancements (tasks 40-44)
40. Add attendees count clickable link on each event card — opens modal with attendee table
41. Attendee modal: flat, resident name, registration date, waitlisted badge
42. Add export attendees CSV button in modal
43. Add "Edit" button on event cards (opens pre-filled create form)
44. Show event status badge (PUBLISHED / CANCELLED / COMPLETED)

#### Maintenance Enhancements (tasks 45-48)
45. Add "Generate Bills" button → modal to select year/month → calls generate endpoint
46. Total collection progress bar: paidAmount / totalAmount as % with color (green ≥80%, amber ≥50%, red <50%)
47. Add "Export CSV" button for current month's bills
48. Overdue bill rows get red left border highlight

#### Notices Enhancements (tasks 49-50)
49. Add target audience selector in create form: All / Residents / Owners / Tenants / Staff
50. Add "Archive" / "Unpin" inline actions on each notice card

---

## File Map

```
backend/src/modules/admin/
  admin.module.ts          # Agent A
  admin.service.ts         # Agent A
  admin.controller.ts      # Agent A

backend/src/modules/event/event.service.ts         # Agent A (add cancelEvent)
backend/src/app.module.ts                          # Agent A (add AdminModule)

apps/admin-web/src/app/service-requests/page.tsx  # Agent A (fix URL)
apps/admin-web/src/components/layout/Sidebar.tsx  # Agent C (add nav items)

apps/admin-web/src/app/canteen/                   # Agent C (new)
apps/admin-web/src/app/medical/                   # Agent C (new)
apps/admin-web/src/app/polls/                     # Agent C (new)
apps/admin-web/src/app/property/                  # Agent C (new)
apps/admin-web/src/app/settings/                  # Agent C (new)

apps/admin-web/src/app/dashboard/page.tsx         # Agent D
apps/admin-web/src/app/residents/page.tsx         # Agent D
apps/admin-web/src/app/staff/page.tsx             # Agent D
apps/admin-web/src/app/service-requests/page.tsx  # Agent D (charts/UX — after Agent A fixes URL)
apps/admin-web/src/app/complaints/page.tsx        # Agent D
apps/admin-web/src/app/events/page.tsx            # Agent D
apps/admin-web/src/app/maintenance/page.tsx       # Agent D
apps/admin-web/src/app/notices/page.tsx           # Agent D
```
