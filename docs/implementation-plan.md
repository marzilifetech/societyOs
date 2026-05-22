# SocietyOS — Detailed Implementation Plan

## Verified as-built status (2026-05-01)

Cross-app audit vs `docs/BRD.pdf` and codebase review (resident-app, staff-app, admin-web, Nest backend). This section is the living “done / partial” summary; phased checklists below remain the historical plan.

| Area | Status | Notes |
|------|--------|--------|
| Monorepo (pnpm + apps) | Done | `apps/resident-app`, `staff-app`, `admin-web`, `backend`, `packages/api-client` |
| Auth OTP + JWT | Done | Controllers under `backend/src/modules/auth` |
| Resident: visitors, complaints, service requests, maintenance UI | Done | Wired to matching Nest modules |
| Resident: notices + polls | Done | `(tabs)/notices.tsx` → `GET /notices`, polls + vote |
| Resident: events, SOS | Done | Event + SOS modules |
| Resident: travel pause + property listings | Partial → **API paths corrected** to `/notices/travel/*`, `/notices/property/*`; optional `reason` on `TravelPause` (migration added) |
| Resident: canteen dish detail / rate | Partial | Menu OK; resident `GET /canteen/dishes/:id` + rate may still need backend parity |
| Resident: medical hub | Partial | Several paths vs `MedicalController` still need alignment (e.g. emergency contacts, appointment detail) |
| Staff app: core attendance + task list | Done | With contract gaps (leave body shape, reviews pagination, task photo URLs `/service-requests` vs `/staff/tasks`) |
| Admin web: dashboard, many CRUD pages | Partial | Uses `admin.controller`; some UI paths lack backend twins (see `docs/admin-tasks.md`) |
| Realtime / FCM / Razorpay hardening | Partial | `docs/prod-readiness.md` must-have rows |

Sub-agent fleet reports from 2026-05-01 are summarized in row notes; treat `docs/BRD.pdf` as product truth and this table + `prod-readiness.md` as engineering gates.

---

## Tech Stack (confirmed from BRD §7)

| Layer | Choice | Reason |
|---|---|---|
| Mobile (Resident + Staff) | React Native (Expo) | Single codebase, iOS + Android, large ecosystem |
| Admin Web | Next.js 14 (App Router) | SSR, SEO, performance |
| Admin UI | shadcn/ui + Tailwind CSS | Accessible, customisable components |
| Charts | Recharts | Flexible, React-native friendly |
| Backend API | NestJS (Node.js) | Modular architecture, WebSocket support, TypeScript |
| Database | PostgreSQL (via Prisma ORM) | ACID compliance, relational data |
| Cache / Queues | Redis + BullMQ | Sessions, real-time queues, background jobs |
| File Storage | AWS S3 (or Cloudflare R2) | Proof photos, documents, receipts |
| Auth | Firebase Auth (OTP) + JWT | Phone OTP, biometric fallback |
| Real-time | Socket.io | SOS alerts, task status, visitor notifications |
| Push Notifications | Firebase Cloud Messaging (FCM) + APNs | Cross-platform, reliable |
| Payments | Razorpay SDK | UPI, Cards, Net Banking — India-first |
| Maps / Geofencing | Google Maps SDK | Attendance geofencing, SOS location |
| CI/CD | GitHub Actions | Automated test + deploy pipelines |
| Hosting | AWS (ECS or Kubernetes) | Auto-scaling, multi-tenant |
| Monitoring | Grafana + Prometheus | Uptime, performance, error rates |

---

## Repository Structure

```
societyos/
├── apps/
│   ├── resident-app/          # React Native (Expo) — iOS & Android
│   ├── staff-app/             # React Native (Expo) — Android focus
│   └── admin-web/             # Next.js 14
├── packages/
│   ├── api-client/            # Shared API types + fetch wrappers (auto-generated from OpenAPI)
│   ├── ui/                    # Shared design tokens, icons (web + RN compatible where possible)
│   └── config/                # Shared ESLint, TypeScript, Tailwind config
├── backend/
│   ├── src/
│   │   ├── modules/           # One NestJS module per domain
│   │   ├── common/            # Guards, interceptors, pipes
│   │   ├── prisma/            # Schema + migrations
│   │   └── main.ts
│   └── test/
├── infrastructure/
│   ├── terraform/             # AWS infra as code
│   └── k8s/                   # Kubernetes manifests
└── .github/workflows/         # CI/CD pipelines
```

---

## Database Schema (Core Entities)

```
societies           — multi-tenant root (id, name, address, config)
users               — all users (id, phone, society_id, role, status)
residents           — resident profile (user_id, flat_id, type: owner|tenant)
flats               — (id, society_id, block, floor, number, area_sqft)
staff_members       — staff profile (user_id, designation, categories[], salary_structure)
visitors            — visitor log (id, resident_id, name, qr_token, status, entry_at, exit_at)
service_requests    — (id, resident_id, category, description, status, assigned_to, sla_deadline)
service_photos      — (id, service_request_id, phase: before|after|during, url, geo, timestamp)
complaints          — (id, resident_id, category, title, description, status, is_anonymous)
canteen_menus       — (id, society_id, date, meal_type, dishes[])
canteen_dishes      — (id, name, calories, allergens[], veg, price)
events              — (id, society_id, title, date, venue, capacity, status)
event_registrations — (id, event_id, resident_id, registered_at, waitlisted)
medical_staff       — (id, society_id, name, designation, schedule[])
appointments        — (id, resident_id, doctor_id, date, time_slot, status)
sos_alerts          — (id, resident_id, lat, lng, status, acknowledged_by, response_time_s)
maintenance_bills   — (id, flat_id, period, breakdown{}, total, due_date, status)
payments            — (id, bill_id, amount, method, gateway_ref, receipt_url, paid_at)
property_listings   — (id, resident_id, area_sqft, price, furnished, status)
travel_pauses       — (id, resident_id, start_date, return_date, services_paused[], status)
notices             — (id, society_id, title, body, target, is_pinned, published_at)
polls               — (id, society_id, question, options[], deadline, is_anonymous)
poll_votes          — (id, poll_id, resident_id, selected_options[])
staff_attendance    — (id, staff_id, date, check_in, check_out, is_late, is_early_departure)
leave_requests      — (id, staff_id, type, start_date, end_date, reason, status)
reviews             — (id, service_request_id, reviewer_id, reviewee_id, stars, comment)
audit_logs          — (id, admin_id, action, module, entity_id, old_val, new_val, at)
```

All tables include `society_id` for multi-tenant row-level isolation. Prisma middleware enforces tenant scoping on every query.

---

## Backend API Design

**Base URL:** `https://api.societyos.in/v1`

**Auth:**
- `POST /auth/otp/send` — send OTP to phone
- `POST /auth/otp/verify` — verify OTP, return JWT + refresh token
- `POST /auth/refresh` — refresh JWT
- `POST /auth/logout`

**Patterns:**
- REST for CRUD operations
- WebSocket (Socket.io) for: SOS alerts, visitor arrival notifications, real-time task status updates
- All responses: `{ data, meta, error }` envelope
- Pagination: cursor-based for feeds, offset for admin tables
- Rate limiting: 100 req/min per user, 10 req/min for OTP endpoints

---

## Phase-by-Phase Implementation Plan

---

### PHASE 1 — MVP (Months 1–3)

Scope (from BRD §10): Visitor Management, Maintenance Payments, Complaints, Utility Services, Staff Attendance, Admin Dashboard.

#### Week 1–2: Foundation
- [ ] Monorepo setup (Turborepo + pnpm workspaces)
- [ ] NestJS backend: project scaffold, Prisma setup, PostgreSQL + Redis connection
- [ ] Multi-tenant middleware (society_id scoping on all DB queries)
- [ ] Firebase Auth integration (OTP flow)
- [ ] JWT + refresh token system
- [ ] GitHub Actions: lint, test, build pipelines
- [ ] AWS infra: RDS (PostgreSQL), ElastiCache (Redis), S3 bucket, ECS task definitions
- [ ] Prisma migrations for core schema: societies, users, residents, flats, staff_members

#### Week 3–4: Auth & Onboarding
**Backend:**
- [ ] `POST /auth/otp/send`, `/auth/otp/verify`
- [ ] `POST /residents/onboard` (flat verification, pending state)
- [ ] Admin API: `PUT /admin/residents/:id/approve`

**Resident App (R-01 to R-07 + R-74):**
- [ ] Splash, Society Search, OTP screens
- [ ] Flat Verification form
- [ ] Pending Approval waiting screen
- [ ] Basic Profile screen

**Admin Portal (A-01 to A-03, A-05, A-06):**
- [ ] Login + 2FA screens
- [ ] Residents list with pending approvals tab
- [ ] Add/edit resident form
- [ ] Approve/reject resident action

#### Week 5–6: Visitor & Gate Management
**Backend:**
- [ ] `POST /visitors` (create visitor pass, generate QR)
- [ ] `GET /visitors` (log with filters)
- [ ] `POST /visitors/:id/approve`, `/deny` (guard action, triggers WS event)
- [ ] `POST /visitors/frequent` (CRUD frequent visitors)
- [ ] `POST /deliveries` (expected deliveries)
- [ ] WebSocket: `visitor:arrival` event → resident push

**Resident App (R-10 to R-16):**
- [ ] Visitors home (Active, Scheduled, History tabs)
- [ ] Pre-approve visitor form + QR code screen
- [ ] Visitor arrival notification (full-screen card with Allow/Deny)
- [ ] Delivery management screen
- [ ] Cab pre-approval form
- [ ] Frequent visitors list + add form

#### Week 7–8: Utility Services
**Backend:**
- [ ] `GET /services/categories` (admin-managed catalog)
- [ ] `GET /services/providers?category=`
- [ ] `POST /service-requests`
- [ ] `PUT /service-requests/:id/status` (status transitions + WS emit)
- [ ] `POST /service-requests/:id/review`
- [ ] `GET /service-requests?resident_id=` (history)
- [ ] SLA check: BullMQ job runs every 15min, flags breaches

**Resident App (R-29 to R-35):**
- [ ] Services catalog grid
- [ ] Provider list + profile
- [ ] Book service form (date, time slot, photos)
- [ ] Service request status tracker (stepper + timeline)
- [ ] Rate & review form
- [ ] History with repeat-request

**Admin Portal (A-15 to A-17):**
- [ ] All service requests table with filters + priority sort
- [ ] Request detail + assign staff
- [ ] SLA configuration screen

#### Week 9–10: Complaints
**Backend:**
- [ ] `POST /complaints` (with photo upload to S3)
- [ ] `GET /complaints?resident_id=` / `GET /complaints` (admin)
- [ ] `PUT /complaints/:id/status` + escalation trigger
- [ ] `POST /complaints/:id/review`
- [ ] BullMQ: auto-escalation job based on SLA rules

**Resident App (R-55 to R-58):**
- [ ] Complaints list (tabs: Active, Resolved)
- [ ] Raise complaint form (category, photos, anonymous toggle)
- [ ] Complaint status tracker
- [ ] Rate resolution form

**Admin Portal (A-31 to A-34):**
- [ ] All complaints table
- [ ] Complaint detail + assign + status update
- [ ] Escalation SLA rules config
- [ ] Complaint analytics (charts)

#### Week 11–12: Maintenance Payments
**Backend:**
- [ ] `GET /bills?flat_id=` (current + history)
- [ ] `POST /payments/initiate` (Razorpay order creation)
- [ ] `POST /payments/verify` (webhook + signature verification)
- [ ] `GET /payments/receipt/:id` (S3 signed URL for PDF)
- [ ] `POST /payments/autopay` (save mandate preference)
- [ ] BullMQ: payment reminders (3 days before due date)

**Resident App (R-62 to R-66):**
- [ ] Payments dashboard (dues card, breakdown, auto-pay status)
- [ ] Payment history
- [ ] Payment flow (Razorpay SDK)
- [ ] Payment success + receipt download
- [ ] Auto-pay setup

**Admin Portal (A-35 to A-39):**
- [ ] Billing configuration
- [ ] Payments overview (Received/Pending/Overdue tabs)
- [ ] Payment detail + refund action
- [ ] Financial reports + export

#### Week 11–12 (parallel): Staff Attendance + Admin Dashboard
**Backend:**
- [ ] `POST /attendance/checkin`, `/checkout` (geofence validation)
- [ ] `GET /attendance?staff_id=&month=`
- [ ] `GET /shifts?staff_id=`
- [ ] Dashboard aggregate endpoint: `GET /admin/dashboard/summary`

**Staff App (S-01 to S-07):**
- [ ] Login (PIN + biometric)
- [ ] Home with check-in CTA
- [ ] Check-in screen (geofence verify)
- [ ] Attendance calendar + log
- [ ] Shift schedule
- [ ] Late arrival report form

**Admin Portal (A-04, A-09 to A-13):**
- [ ] Main dashboard (stat cards, charts, activity feed)
- [ ] Staff list
- [ ] Staff profile + attendance log
- [ ] Leave requests approval (Pending tab only for now)

**Phase 1 Deliverable:** Internal QA build. Pilot with 1 test society.

---

### PHASE 2 — CORE+ (Months 4–6)

Scope: Canteen, Events, Medical SOS & Appointments, Staff Task App (full), Staff Reviews, Leave Management, Property Sale, Travel Pause, Notices & Communication.

#### Month 4, Week 1–2: Staff Task Management (full)
**Backend:**
- [ ] `GET /tasks?staff_id=` (assigned tasks)
- [ ] `PUT /tasks/:id/status` (Accepted/InProgress/Completed/Rejected)
- [ ] `POST /tasks/:id/photos` (S3 upload, geotagged)
- [ ] `POST /tasks/:id/voice-note` (S3 upload)
- [ ] WebSocket: `task:assigned` push to staff

**Staff App (S-08 to S-12):**
- [ ] Tasks list (Pending/In Progress/Completed)
- [ ] Task detail (full actions)
- [ ] Reject task form
- [ ] Photo upload (before/after with camera)
- [ ] Task history

#### Month 4, Week 3–4: Staff Reviews + Leave
**Backend:**
- [ ] `GET /reviews?reviewee_id=` (staff view)
- [ ] `POST /reviews/:id/flag`
- [ ] `POST /leave-requests`
- [ ] `PUT /leave-requests/:id/status` (admin approve/reject)
- [ ] `GET /holidays?society_id=`

**Staff App (S-13 to S-18):**
- [ ] My ratings screen (score, trend, reviews)
- [ ] Flag review form
- [ ] Leave management home (balances)
- [ ] Apply for leave form
- [ ] Holiday calendar

**Admin Portal (A-13, A-14):**
- [ ] All leave requests with approve/reject
- [ ] Performance reports

#### Month 5, Week 1–2: Canteen
**Backend:**
- [ ] `GET /canteen/menu?date=&society_id=` (today/week)
- [ ] `POST /canteen/menu` (admin create/update)
- [ ] `POST /canteen/dishes/:id/rate`
- [ ] `GET /canteen/dishes/popular`
- [ ] `POST /canteen/preorders` (if enabled)
- [ ] `GET /canteen/analytics`

**Resident App (R-36 to R-41):**
- [ ] Canteen home (Today + Weekly tabs)
- [ ] Dish detail
- [ ] Rate dish
- [ ] Pre-order form
- [ ] Popular dishes

**Admin Portal (A-18 to A-21):**
- [ ] Daily menu editor
- [ ] Weekly menu grid
- [ ] Canteen analytics
- [ ] Pre-order management

#### Month 5, Week 3–4: Events
**Backend:**
- [ ] `GET /events?society_id=` (upcoming)
- [ ] `POST /events/:id/rsvp`, `DELETE /events/:id/rsvp`
- [ ] `GET /events/:id/attendees`
- [ ] `POST /events/:id/feedback`
- [ ] BullMQ: event reminder jobs (24h + 1h before)

**Resident App (R-42 to R-46):**
- [ ] Events list
- [ ] Event detail + RSVP
- [ ] RSVP confirmation
- [ ] Attendees list
- [ ] Post-event feedback

**Admin Portal (A-22 to A-25):**
- [ ] Events list + create/edit form
- [ ] Attendees view
- [ ] Post-event feedback

#### Month 6, Week 1–2: Medical SOS & Appointments
**Backend:**
- [ ] `POST /sos` (emits WS to alert recipients simultaneously, logs GPS)
- [ ] `PUT /sos/:id/acknowledge`
- [ ] `PUT /sos/:id/cancel`
- [ ] `GET /medical-staff?society_id=`
- [ ] `GET /medical-staff/:id/slots?date=`
- [ ] `POST /appointments`
- [ ] `PUT /appointments/:id/cancel`, `/reschedule`
- [ ] BullMQ: appointment reminder (24h before)

**Resident App (R-47 to R-54):**
- [ ] SOS activation with 5s countdown
- [ ] SOS acknowledgement status
- [ ] Medical help desk home
- [ ] Doctor profile
- [ ] Book appointment
- [ ] My appointments
- [ ] Cancel/reschedule

**Admin Portal (A-26 to A-30):**
- [ ] Medical staff list + form
- [ ] Appointment slots
- [ ] Appointment records
- [ ] SOS alerts log
- [ ] SOS configuration

#### Month 6, Week 3–4: Property Sale, Travel Pause, Notices & Polls
**Backend:**
- [ ] `POST /property-listings`, `PUT /property-listings/:id`, `DELETE`
- [ ] `PUT /property-listings/:id/approve`, `/reject` (admin)
- [ ] `POST /property-listings/:id/interest`
- [ ] `POST /travel-pauses`, `PUT /travel-pauses/:id/return`
- [ ] `PUT /travel-pauses/:id/approve` (admin)
- [ ] `POST /notices`, `PUT /notices/:id`
- [ ] `POST /polls`, `POST /polls/:id/vote`
- [ ] `GET /polls/:id/results`

**Resident App (R-67 to R-73, R-20 to R-28):**
- [ ] Property listing screens (my listing, submit, community board, detail)
- [ ] Travel mode screens (home, submit, status)
- [ ] Notices list + detail
- [ ] Polls list + vote + results
- [ ] Neighbour messaging (basic text chat)
- [ ] Forum list + thread

**Admin Portal (A-40 to A-47):**
- [ ] Property listings approval
- [ ] Travel pauses review
- [ ] Notices management + create
- [ ] Polls + results
- [ ] Push notification composer
- [ ] Communication archive

**Phase 2 Deliverable:** Feature-complete build. Beta with 3-5 societies.

---

### PHASE 3 — ADVANCED (Months 7–9)

Scope: Advanced Analytics, Biometric Integration, Video Consultation, CCTV Access, Staff Community Platform, Staff Profile & Documents.

#### Month 7: Analytics & Reporting
- [ ] Admin dashboard: advanced charts (complaint resolution time, service ratings trend, payment compliance %)
- [ ] Financial reports: PDF generation (Puppeteer or react-pdf), Tally XML export
- [ ] Staff performance PDF reports
- [ ] Complaint analytics page (A-34)
- [ ] Canteen analytics enhancements

#### Month 7: Security Alerts + CCTV
- [ ] Security alerts feed (R-17, R-18)
- [ ] Report suspicious activity
- [ ] CCTV integration scaffold: ONVIF API proxy (admin enables per camera, resident views via signed RTSP token) — gated behind admin toggle

#### Month 8: Staff Community Platform
**Staff App (S-19 to S-22):**
- [ ] Staff notice board
- [ ] Group messaging (Socket.io group chat per team)
- [ ] Training materials (document viewer)
- [ ] Recognition board

**Staff App (S-23 to S-25):**
- [ ] Profile, documents, salary slips

#### Month 8: Biometric Integration
- [ ] ZKTeco / eSSL API integration (optional, society-configurable)
- [ ] Admin: biometric hardware config in settings
- [ ] Fallback to GPS geofence if no biometric hardware

#### Month 9: Video Consultation (Telehealth)
- [ ] Twilio Video SDK integration (admin-enabled feature flag)
- [ ] Resident: video call CTA on appointment screen
- [ ] Doctor side: admin-provisioned staff account, join call from admin portal

#### Month 9: Notification Settings, Language, DPDP Compliance
- [ ] Resident: per-category notification toggles (R-75)
- [ ] Language switching in both mobile apps (i18n with i18next)
- [ ] Hindi, Kannada, Tamil, Telugu, Marathi translations (strings only)
- [ ] DPDP: consent flow at onboarding, data deletion request, data export request (A-52)
- [ ] Audit trail UI (A-51)
- [ ] Staff Help Requests (R-59 to R-61) — if not done in Phase 1

---

### PHASE 4 — SCALE (Months 10–12)

- [ ] Multi-society management console (super-admin dashboard across all societies)
- [ ] White-label theming (society logo, color overrides)
- [ ] Marketplace for external vendors (scope definition needed)
- [ ] Public API with API key management for third-party integrations
- [ ] Penetration testing + security audit
- [ ] App Store submissions (iOS TestFlight → production, Android Play Store)
- [ ] Performance optimisation: DB query analysis, Redis cache warming
- [ ] Hypercare support tooling (internal admin tools for CS team)

---

## Non-Functional Implementation Notes

### Multi-tenancy
Every API endpoint extracts `society_id` from the authenticated JWT. Prisma middleware appends `where: { society_id }` to every query. No cross-society data is ever joinable in a single query.

### Real-time (Socket.io rooms)
- Room naming: `society:{id}:resident:{user_id}`, `society:{id}:admin`, `society:{id}:gate`, `society:{id}:staff:{user_id}`
- SOS: emits to `society:{id}:admin` + `society:{id}:gate` + configured first-responder users simultaneously

### Offline Mode (Resident App)
- React Query + async-storage: cache last-fetched data
- Complaint form: stored locally if offline, synced via BullMQ on reconnect
- Push notification queued via FCM even when app is closed

### File Uploads
- Direct upload: presigned S3 URL (resident/staff uploads directly to S3, not proxied through API)
- Backend receives only the S3 key after upload completes
- Image compression: react-native-image-resizer (max 1200px, 80% JPEG quality before upload)

### Payment Security
- Razorpay: never store card details. Only store `razorpay_payment_id` + `razorpay_order_id` + signature hash
- Verify signature server-side before marking payment as complete
- Webhooks: validate signature header before processing

### Staff App Performance
- APK < 30MB: exclude heavy libraries, use Hermes JS engine
- Offline task list: SQLite via expo-sqlite, syncs on connection

### Security Headers (API)
- Helmet.js: HSTS, CSP, X-Frame-Options
- Rate limiting: nestjs-throttler (100/min default, 10/min auth endpoints)
- Input validation: class-validator on all DTOs
- SQL injection: Prisma parameterized queries (no raw SQL)
- CORS: whitelist admin-web domain + mobile app origin

---

## Testing Strategy

| Layer | Approach |
|---|---|
| Backend unit | Jest + NestJS testing utilities, mock Prisma |
| Backend integration | Supertest against test DB (Docker PostgreSQL) |
| API contract | OpenAPI spec → automated contract tests |
| Mobile | React Native Testing Library + Jest |
| E2E | Detox (mobile), Playwright (admin web) |
| Load testing | k6 scripts for critical paths: checkin, payment, SOS |
| Security | OWASP ZAP scan pre-launch, manual pentest |

Coverage targets: 80% backend, 70% mobile (critical flows only).

---

## Team Structure (Recommended)

| Role | Count | Phase |
|---|---|---|
| Backend Engineer (NestJS) | 2 | Phase 1+ |
| React Native Engineer | 2 | Phase 1+ |
| Next.js / Admin Portal Engineer | 1 | Phase 1+ |
| UI/UX Designer | 1 | Phase 1–2 |
| QA Engineer | 1 | Phase 1+ |
| DevOps / Infra | 1 (part-time P1, full P3) | Phase 1+ |
| Product Manager | 1 | All |

---

## Go-Live Checklist (Phase 1)

- [ ] Phase 1 development complete and QA signed off
- [ ] Pilot with 1-2 test societies (resident + staff + admin onboarded)
- [ ] Load test: 500 concurrent users, API p95 < 1.5s
- [ ] Security: OWASP ZAP scan, dependency audit (npm audit)
- [ ] Razorpay go-live approval (KYC + business verification)
- [ ] Firebase project production configuration (not dev)
- [ ] Environment variables secured in AWS Secrets Manager
- [ ] SSL certificates configured (ACM)
- [ ] DB backups configured (daily, 90-day retention, automated snapshots)
- [ ] Monitoring dashboards live (Grafana)
- [ ] On-call runbook written
- [ ] App Store: Apple Developer account + Google Play Console set up
- [ ] Privacy Policy + Terms of Service published (DPDP compliant)
- [ ] Resident and staff onboarding guides prepared (PDF + video)
- [ ] Hypercare support channel set up (Slack/WhatsApp for pilot societies)
