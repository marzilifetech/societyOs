# SocietyOS - Missing Features

## Summary
- **High Impact Missing Features:** 12
- **Medium Impact Missing Features:** 8
- **Low Impact Missing Features:** 5

---

## Resident App

### Missing: Notices Display
**Impact:** High  
**BRD Ref:** Phase 1 - Resident App (R-19 to R-21)  
**What Exists:** 
- Backend: `GET /notices` on `NoticeController`, poll routes
- UI: `apps/resident-app/app/(tabs)/notices.tsx` — **connected**

**What Needs to be Added:**
- Pinned / category polish, offline cache (optional)
- Confirm admin targeting filters match BRD

---

### Missing: Polls Voting
**Impact:** Medium  
**BRD Ref:** Phase 2 - Resident App (R-20 to R-22)  
**What Exists:**
- Backend: `Poll`, `PollVote` models in schema
- UI: No polls screen found in resident-app

**What Needs to be Added:**
- Backend: `GET /polls`, `POST /polls/:id/vote` endpoints
- UI: Create polls list screen
- UI: Create voting interface
- UI: Display results after voting

---

### Missing: Community Forum / Neighbour Messaging
**Impact:** Medium  
**BRD Ref:** Phase 2 - Resident App (R-23 to R-26)  
**What Exists:**
- Backend: `CommunityPost`, `PostComment` models in schema
- UI: No community forum screen found

**What Needs to be Added:**
- Backend: `POST /community/posts`, `GET /community/posts`, `POST /community/posts/:id/comments`
- UI: Create community feed screen
- UI: Create post detail with comments
- UI: Create new post form

---

### Missing: Property Listings - Community Board
**Impact:** High  
**BRD Ref:** Phase 2 - Resident App (R-67 to R-70)  
**What Exists:**
- Backend: `PropertyListing` under `NoticeController` at **`/notices/property/listings`** (resident + society)
- UI: `apps/resident-app/app/property/index.tsx` — **paths aligned (2026-05-01)**

**What Needs to be Added:**
- Listing withdraw/sold flows if required by BRD
- Admin approval UX already on `/notices/admin/property/*`

---

### Missing: Travel Pause Mode
**Impact:** Medium  
**BRD Ref:** Phase 2 - Resident App (R-71 to R-73)  
**What Exists:**
- Backend: `TravelPause` via **`/notices/travel/pauses`** on `NoticeController`
- UI: `apps/resident-app/app/travel/index.tsx` — **wired + mutations fixed (2026-05-01)**; optional `reason` stored when migration applied

**What Needs to be Added:**
- Admin approval queue already at `/notices/admin/travel/pauses`
- Push reminder before return (BRD) — backend jobs

---

### Missing: Health Vitals Tracking
**Impact:** Medium  
**BRD Ref:** Phase 2 - Resident App (Health Module)  
**What Exists:**
- Backend: `HealthVital`, `Medication`, `HealthRecord` models in schema
- UI: `apps/resident-app/app/health/vitals/index.tsx`, `apps/resident-app/app/health/vitals/log.tsx`, `apps/resident-app/app/health/vitals/[type].tsx` exist

**What Needs to be Added:**
- Backend: `POST /health/vitals`, `GET /health/vitals` endpoints
- Backend: `POST /medications`, `GET /medications` endpoints
- Backend: `POST /health/records`, `GET /health/records` endpoints
- Connect UI screens to backend APIs

---

### Missing: Family Members Management
**Impact:** Low  
**BRD Ref:** Phase 1 - Resident App (R-08)  
**What Exists:**
- Backend: `FamilyMember` model in schema
- UI: No family management screen found

**What Needs to be Added:**
- Backend: CRUD endpoints for family members
- UI: Add/edit/remove family members
- Permissions management per family member

---

### Missing: Notification Settings
**Impact:** Medium  
**BRD Ref:** Phase 3 - Resident App (R-75)  
**What Exists:**
- Backend: Partial (notification preferences fields exist in User model)
- UI: `apps/resident-app/app/settings/notifications.tsx` exists

**What Needs to be Added:**
- Backend: `PATCH /auth/notification-prefs` - verify this works properly
- UI: Per-category notification toggles
- Sound/vibration settings

---

### Missing: Help Requests (Staff Help)
**Impact:** High  
**BRD Ref:** BRD Section R-59 to R-61  
**What Exists:**
- Backend: `HelpRequest` model in schema
- UI: No help request screen found in resident-app

**What Needs to be Added:**
- Backend: `POST /help-requests`, `GET /help-requests/my` endpoints
- Backend: Connect to staff-app for help requests
- UI: Create help request form
- UI: Track help request status

---

## Staff App

### Missing: Staff Community - Group Messaging
**Impact:** Medium  
**BRD Ref:** Phase 3 - Staff App (S-20 to S-21)  
**What Exists:**
- Backend: `StaffMessageGroup`, `StaffMessage` models in schema
- Backend: `StaffCommunityController` exists
- UI: `apps/staff-app/app/community/messages.tsx` exists

**What Needs to be Added:**
- Backend: Verify endpoints are fully functional
- Connect UI to backend
- Real-time WebSocket for messages

---

### Missing: Staff Training Materials
**Impact:** Medium  
**BRD Ref:** Phase 3 - Staff App (S-22)  
**What Exists:**
- Backend: `TrainingMaterial` model in schema
- UI: `apps/staff-app/app/community/training.tsx` exists

**What Needs to be Added:**
- Backend: `GET /staff/training-materials` endpoint
- Connect UI to backend
- Document viewer integration

---

### Missing: Staff Recognition Board
**Impact:** Low  
**BRD Ref:** Phase 3 - Staff App (S-23)  
**What Exists:**
- Backend: `Recognition` model in schema
- UI: `apps/staff-app/app/community/recognition.tsx` exists

**What Needs to be Added:**
- Backend: `POST /staff/recognitions`, `GET /staff/recognitions` endpoints
- Connect UI to backend

---

### Missing: QR Code Scanning for Tasks
**Impact:** High  
**BRD Ref:** Staff App - Task Scanning  
**What Exists:**
- UI: `apps/staff-app/app/scan/qr.tsx` exists
- Backend: Visitor QR logic exists

**What Needs to be Added:**
- Staff can scan QR codes for visitor check-in
- Staff can scan QR to identify task/location
- Integrate with visitor system

---

### Missing: Staff Documents & Salary Slips
**Impact:** Medium  
**BRD Ref:** Phase 3 - Staff App (S-23 to S-24)  
**What Exists:**
- Backend: `SalarySlip` model in schema
- UI: `apps/staff-app/app/documents/index.tsx`, `apps/staff-app/app/salary/index.tsx` exist

**What Needs to be Added:**
- Backend: `GET /staff/salary` endpoint exists (verified in staff.controller.ts)
- Connect salary slips UI to backend
- Connect documents UI to backend

---

## Admin Web

### Missing: Resident Management - Approval Workflow
**Impact:** High  
**BRD Ref:** Phase 1 - Admin Portal (A-01 to A-06)  
**What Exists:**
- UI: `apps/admin-web/src/app/residents/page.tsx` exists

**What Needs to be Added:**
- Backend: `PATCH /admin/residents/:id/approve`, `PATCH /admin/residents/:id/reject`
- UI: Add pending approvals tab
- UI: Add approve/reject actions in resident list
- Profile editing functionality

---

### Missing: Event Management
**Impact:** High  
**BRD Ref:** Phase 2 - Admin Portal (A-22 to A-25)  
**What Exists:**
- Backend: `EventController` exists with create, update, cancel endpoints
- UI: `apps/admin-web/src/app/events/page.tsx`, `apps/admin-web/src/app/events/[id]/page.tsx` exist

**What Needs to be Added:**
- Connect UI to backend for CRUD operations
- Add event creation form
- View attendees list
- Manage registrations

---

### Missing: Notices Management
**Impact:** High  
**BRD Ref:** Phase 2 - Admin Portal (A-40 to A-41)  
**What Exists:**
- Backend: `Notice` model exists
- UI: `apps/admin-web/src/app/notices/page.tsx` exists

**What Needs to be Added:**
- Backend: `POST /notices`, `PATCH /notices/:id`, `DELETE /notices/:id` endpoints
- Connect UI to backend
- Create notice form with targeting options

---

### Missing: Polls Management
**Impact:** Medium  
**BRD Ref:** Phase 2 - Admin Portal (A-42 to A-43)  
**What Exists:**
- Backend: `Poll`, `PollVote` models exist
- UI: `apps/admin-web/src/app/polls/page.tsx` exists

**What Needs to be Added:**
- Backend: `POST /polls`, `GET /polls/:id/results` endpoints
- Connect UI to backend
- Create poll form
- View results interface

---

### Missing: SOS Configuration & Alert Management
**Impact:** High  
**BRD Ref:** Phase 2 - Admin Portal (A-26 to A-30)  
**What Exists:**
- Backend: `SosController` with acknowledge, resolve endpoints
- UI: `apps/admin-web/src/app/sos/page.tsx` exists

**What Needs to be Added:**
- Connect UI to active SOS alerts
- Acknowledge/resolve actions from admin
- SOS configuration settings (first responders, etc.)

---

### Missing: Property Listings Management
**Impact:** Medium  
**BRD Ref:** Phase 2 - Admin Portal (A-40)  
**What Exists:**
- Backend: `PropertyListing` model exists
- UI: `apps/admin-web/src/app/property/page.tsx` exists

**What Needs to be Added:**
- Backend: `GET /admin/property-listings`, `PATCH /property-listings/:id/approve` endpoints
- Connect UI to backend
- Approve/reject property listings

---

### Missing: Visitors Management
**Impact:** Medium  
**BRD Ref:** Phase 1 - Admin Portal (A-07 to A-08)  
**What Exists:**
- Backend: `VisitorController` exists
- UI: `apps/admin-web/src/app/visitors/page.tsx` exists

**What Needs to be Added:**
- Connect UI to backend for visitor list
- Real-time visitor arrival updates
- Check-in/check-out actions

---

### Missing: Staff Leave Management
**Impact:** Medium  
**BRD Ref:** Phase 2 - Admin Portal (A-13 to A-14)  
**What Exists:**
- Backend: `PATCH /staff/leave/:id` endpoint exists
- UI: Staff page exists but may not show leave management

**What Needs to be Added:**
- UI: Add leave requests section in staff management
- Approve/reject leave actions
- Leave balance overview

---

### Missing: Advanced Analytics & Reports
**Impact:** Low  
**BRD Ref:** Phase 3 - Admin Portal  
**What Exists:**
- UI: Dashboard has basic charts

**What Needs to be Added:**
- Complaint resolution time analytics
- Service ratings trend charts
- Payment compliance percentage
- Staff performance reports
- Financial reports (Tally XML export)

---

## Backend Modules Missing or Incomplete

### Missing: Notification Module Endpoints
**Impact:** High  
**What Exists:**
- `NotificationService` exists but limited exposed endpoints

**What Needs to be Added:**
- Push notification triggers for all events
- Admin notification preferences management

---

### Missing: Real-time WebSocket Connections
**Impact:** High  
**What Exists:**
- `SosGateway` for SOS alerts
- Basic socket setup

**What Needs to be Added:**
- Visitor arrival notifications to resident
- Task assignment notifications to staff
- Complaint status changes to resident
- Community messages (staff and resident)

---

### Missing: Complete Admin Controller
**Impact:** High  
**What Exists:**
- `admin.controller.ts` with dashboard stats

**What Needs to be Added:**
- Resident CRUD operations
- Staff CRUD operations
- Society configuration endpoints
- Bulk operations

---

## Summary by Priority

### High Priority (12 items)
1. Notices Display - Resident App
2. Property Listings - Resident App
3. Help Requests - Resident App  
4. QR Code Scanning - Staff App
5. Resident Approval Workflow - Admin Web
6. Event Management - Admin Web
7. Notices Management - Admin Web
8. SOS Management - Admin Web
9. Visitors Management - Admin Web
10. Notification Module - Backend
11. Real-time WebSockets - Backend
12. Admin Controller - Backend

### Medium Priority (8 items)
1. Polls Voting - Resident App
2. Community Forum - Resident App
3. Travel Pause Mode - Resident App
4. Health Vitals - Resident App
5. Staff Community Messaging - Staff App
6. Staff Training - Staff App
7. Staff Documents - Staff App
8. Polls Management - Admin Web

### Low Priority (5 items)
1. Family Members - Resident App
2. Notification Settings - Resident App
3. Staff Recognition - Staff App
4. Property Management - Admin Web
5. Advanced Analytics - Admin Web

