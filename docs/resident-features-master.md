# SocietyOS — Resident App Master Feature Document
**Persona: Affluent Senior Citizen (65–80+, apartment owner, retired professional)**
**Version: 2.0 | Date: 2026-04-30**

---

## Design Philosophy — 2060, Not 2020

This is not a utility app. It is a **living companion** for an affluent senior's home.

**Aesthetic direction:**
- **Glassmorphism + depth layers** — frosted glass cards over ambient gradient backgrounds, not flat Material cards
- **Spatial UI** — sections feel like physical rooms, not a list of menu items
- **Ambient intelligence** — home screen surfaces the right card at the right time (morning: canteen menu + medication reminder; evening: visitor expected + event tonight)
- **Voice-first** — every action reachable by natural speech; visual is a confirmation, not the primary channel
- **AI-assisted shortcuts** — "It's Wednesday. You usually call the plumber at 10am. Book again?" — predictive cards
- **Haptic grammar** — distinct haptic patterns for SOS (triple pulse), approval (soft click), payment (deep thud), notification (light tap)
- **60fps fluid transitions** — shared element transitions between screens, no hard cuts
- **Dark/AMOLED-first** — deep blacks, luminous accent colors (not white backgrounds)
- **Biometric as default** — app wakes with face/fingerprint, no lock screen delay
- **Contextual density** — text and controls scale to 120% by default for senior persona; adaptive layout
- **Calm tech principles** — no badges, no red dots, no urgency theater unless genuinely urgent
- **Typography** — large, high-contrast serif headers for dignity; clean sans for data

**Color palette:**
- Background: #0A0A0F (near-black)
- Surface: rgba(255,255,255,0.06) glass
- Primary accent: #6C63FF (electric violet)
- Emergency: #FF3B30 (true red, reserved for SOS only)
- Success: #34C759
- Text primary: #F5F5F7
- Text secondary: #8E8E93

---

## Persona Brief

The primary resident is a retired doctor, businessman, or IAS officer who owns a premium flat in a gated community. They:
- Live alone or with a spouse; adult children in other cities
- Have full-time domestic help (cook, maid, driver)
- Are health-conscious with multiple routine doctors and medications
- Value dignity — they do not want to "figure out" an app; it must be intuitive
- Are security-conscious; know every neighbor by face
- Pay all bills on time and expect full transparency
- Attend society events, participate in AGM, have opinions on community matters
- May have reduced mobility — lifts are life-critical, physical office visits unacceptable
- Want family members to be informed without being patronized themselves

**Design mandates for this persona:**
- Minimum 16sp base font, scalable to 24sp
- Every action confirms with haptic feedback
- No dead ends — every screen has a clear "back" and "help" path
- All critical actions (SOS, payment, visitor approve) reachable in ≤2 taps from home
- Biometric login (Face ID / fingerprint) — no password memorization
- Offline-first for read operations; graceful degradation
- WhatsApp fallback for critical notifications

---

## Part 1 — BRD Feature Set (All 13 Modules, Resident-Facing)

### F-01: Visitor & Gate Management
**Story:** "My daughter is coming from Delhi. I want her to enter without calling me."

**Micro-tasks:**
- [ ] B-01: `POST /visitors` — create visitor with name, phone, expected date, photo URL
- [ ] B-02: `GET /visitors/my` — paginated visitor list for resident (filter: upcoming, past, denied)
- [ ] B-03: `GET /visitors/:id` — single visitor detail with status timeline
- [ ] B-04: `GET /visitors/qr/:token` — gate staff scans QR → get visitor info
- [ ] B-05: `POST /visitors/check-in` — gate staff marks arrival; push notification to resident
- [ ] B-06: `PATCH /visitors/:id/check-out` — mark departure
- [ ] B-07: `PATCH /visitors/:id/deny` — resident denies entry
- [ ] B-08: `PATCH /visitors/:id/extend` — extend validity of pre-approval
- [ ] B-09: `POST /visitors/recurring` — create recurring visitor (domestic help, driver) with weekly/daily schedule
- [ ] B-10: `PATCH /visitors/recurring/:id/suspend` — temporarily suspend recurring access
- [ ] UI-01: Visitor list screen with tab: Upcoming / Active / History
- [ ] UI-02: Add visitor form — name, phone, photo, date range, purpose
- [ ] UI-03: QR code display screen with share button (WhatsApp, copy link)
- [ ] UI-04: Real-time notification bottom sheet on visitor arrival with Approve/Deny/Call buttons
- [ ] UI-05: Recurring visitor management — list of domestic help with suspend toggle
- [ ] UI-06: Delivery sub-type — expected parcels log with courier name and tracking number
- [ ] UI-07: Visitor detail screen with full timeline (Created → Approved → Arrived → Left)
- [ ] UI-08: One-tap repeat invite from history

**Proof & Rating:** After visitor departs, resident optionally rates the gate entry experience (was staff courteous, was entry smooth) — 1-5 stars, shown in admin security reports.

---

### F-02: Security & Alerts
**Story:** "I heard a noise in the parking. I want to alert security without making a scene."

**Micro-tasks:**
- [ ] B-11: `POST /sos` — medical SOS with resident location, flat, timestamp
- [ ] B-12: `GET /sos/active` — admin/security sees all active SOS
- [ ] B-13: `PATCH /sos/:id/acknowledge` — security acknowledges; resident sees "Help is coming"
- [ ] B-14: `PATCH /sos/:id/resolve` — mark SOS resolved with response time logged
- [ ] B-15: `POST /security/report` — resident reports suspicious activity (text + optional photo)
- [ ] B-16: `GET /notices?type=EMERGENCY` — fetch emergency broadcasts
- [ ] UI-09: Prominent SOS button on home screen — red, full-width, above fold
- [ ] UI-10: SOS confirmation dialog — 5-second countdown to cancel (prevents false alarms)
- [ ] UI-11: SOS active screen — shows "Help acknowledged" / responder name when staff responds
- [ ] UI-12: SOS history log — list of past SOS with timestamps and resolution time
- [ ] UI-13: Report suspicious activity form — category, description, photo upload
- [ ] UI-14: Emergency contacts quick-dial strip — society doctor, gate, ambulance

**Proof & Rating:** After SOS resolved, resident can rate response quality (speed, staff behavior) — feeds into admin SOS response-time dashboard.

---

### F-03: Society Notices & Communication
**Story:** "The AGM agenda came via WhatsApp. I want one official place for all announcements."

**Micro-tasks:**
- [ ] B-17: `GET /notices` — paginated notices (filter: GENERAL, EMERGENCY, MAINTENANCE, EVENT)
- [ ] B-18: `GET /notices/:id` — single notice with full content
- [ ] B-19: `POST /notices/:id/read` — mark as read (admin sees read receipts)
- [ ] B-20: `GET /polls` — active polls for resident's society
- [ ] B-21: `POST /polls/:id/vote` — cast vote with idempotency guard
- [ ] B-22: `GET /polls/:id/results` — see results after voting
- [ ] UI-15: Notices tab — card list with category badge, unread dot, date
- [ ] UI-16: Notice detail screen — full rich text, attachment viewer (PDF tap-to-open)
- [ ] UI-17: Polls screen — active polls with question, options, voting deadline
- [ ] UI-18: Poll result screen — horizontal bar chart of vote distribution
- [ ] UI-19: Notice filter pills — All / General / Emergency / Events / Financial
- [ ] UI-20: Push notification deep-link — tapping notice notification opens the specific notice

**Proof & Rating:** N/A (admin-originated content). Resident can "acknowledge" critical notices which logs confirmation.

---

### F-04: Utility Service Request Management
**Story:** "My kitchen tap is leaking. I want a plumber today, not tomorrow, not via the building office."

**Micro-tasks:**
- [ ] B-23: `GET /services` — list service categories with available staff count
- [ ] B-24: `POST /service-requests` — create request with category, description, photos, preferred slot
- [ ] B-25: `GET /service-requests/my` — resident's request history (paginated, filterable by status)
- [ ] B-26: `GET /service-requests/:id` — full detail with status timeline and assigned staff
- [ ] B-27: `PATCH /service-requests/:id/cancel` — cancel if not yet assigned
- [ ] B-28: `POST /service-requests/:id/rating` — submit rating after completion (1-5 stars + text)
- [ ] B-29: `POST /service-requests/:id/reopen` — dispute completion, reopen request
- [ ] B-30: `POST /service-requests/from-history/:id` — clone a past request as new
- [ ] UI-21: Services home — grid of service icons (Plumber, Electrician, Carpenter, Painter, Pest Control, AC Repair, Appliance, Housekeeping)
- [ ] UI-22: Service request form — description field, slot picker, photo attach (up to 3)
- [ ] UI-23: My Requests list — status chip (Pending/Assigned/In Progress/Completed/Disputed)
- [ ] UI-24: Request detail screen — staff name + photo, timeline, proof-of-work photos uploaded by staff
- [ ] UI-25: Live status update — push notification at every status change
- [ ] UI-26: Rating screen — star selector, text review, optional photo of completed work
- [ ] UI-27: Dispute flow — "Not satisfied" button opens reopen form with description
- [ ] UI-28: Request history — searchable, with "Book again" shortcut

**Proof & Rating (MANDATORY):** Service is not marked COMPLETED until resident-facing proof photos (uploaded by staff) are visible. After staff marks complete, resident receives notification to confirm and rate (1-5 stars + text). Unrated requests prompt a reminder after 24 hours. Average staff rating visible on their profile.

---

### F-05: Community Canteen
**Story:** "I don't want to cook every day. I want to know what's for lunch before I decide."

**Micro-tasks:**
- [ ] B-31: `GET /canteen/menu` — this week's menus grouped by date and mealType
- [ ] B-32: `GET /canteen/menu?date=YYYY-MM-DD` — specific day's menu
- [ ] B-33: `POST /canteen/menu/:menuId/dishes/:dishId/rate` — rate a dish (1-5 stars + comment)
- [ ] B-34: `GET /canteen/menu/:menuId/dishes/:dishId/ratings` — dish rating summary
- [ ] B-35: `POST /canteen/pre-order` — pre-order meal for a slot (if enabled by admin)
- [ ] B-36: `GET /canteen/pre-orders/my` — my pre-orders
- [ ] B-37: `DELETE /canteen/pre-orders/:id` — cancel pre-order
- [ ] UI-29: Canteen home — today's menu by meal type tabs (Breakfast / Lunch / Snacks / Dinner)
- [ ] UI-30: Week view — horizontal date strip, scroll to see full week
- [ ] UI-31: Dish card — name, price, veg/non-veg indicator, calorie count, allergen tags
- [ ] UI-32: Dish detail bottom sheet — full description, ratings summary, top reviews
- [ ] UI-33: Rate dish — star rating + comment, shown after meal time passes
- [ ] UI-34: Popular dishes section — community top-rated dishes of the week
- [ ] UI-35: Pre-order flow — select meal, quantity, slot, confirm (if enabled)
- [ ] UI-36: Pre-order history with cancel option

**Proof & Rating:** Each dish rateable by resident after the meal time window. Aggregate ratings visible on dish cards. Admin sees dish popularity trends.

---

### F-06: Event Management
**Story:** "There's a Diwali get-together. I want to RSVP and know who else from my floor is coming."

**Micro-tasks:**
- [ ] B-38: `GET /events` — upcoming + past events
- [ ] B-39: `GET /events/:id` — event detail with attendee count
- [ ] B-40: `POST /events/:id/register` — RSVP
- [ ] B-41: `DELETE /events/:id/register` — cancel RSVP
- [ ] B-42: `GET /events/:id/attendees` — list of attending residents (name + flat)
- [ ] B-43: `POST /events/:id/feedback` — post-event rating + comments
- [ ] UI-37: Events list — upcoming cards with date, venue, capacity badge, RSVP button
- [ ] UI-38: Event detail screen — full description, organizer, venue map, attendee list
- [ ] UI-39: RSVP confirmation with add-to-calendar prompt
- [ ] UI-40: Attendees list — names and flats (anonymizable by admin)
- [ ] UI-41: Post-event feedback prompt — pushed 1 hour after event ends
- [ ] UI-42: Event reminder notification — 24h and 1h before

**Proof & Rating:** Post-event feedback screen (1-5 stars, comments) pushed to all attendees 1 hour after event end time. Admin sees aggregate event satisfaction scores.

---

### F-07: Medical SOS
*(Covered within F-02 above — dedicated SOS section)*
*Additional micro-tasks:*
- [ ] B-44: `GET /sos/:id` — resident views their own SOS history item with full response log
- [ ] B-45: `GET /medical/emergency-contacts` — society's configured emergency numbers
- [ ] UI-43: SOS landing screen (post-press) — shows responders, ETA, cancel option
- [ ] UI-44: Emergency contacts screen — tappable phone numbers (doctor, ambulance, gate, admin)

---

### F-08: Medical Help Desk Appointments
**Story:** "My knee hurts. I want to see the society physio today without driving to a clinic."

**Micro-tasks:**
- [ ] B-46: `GET /medical/doctors` — list available doctors/nurses with specialty, schedule
- [ ] B-47: `GET /medical/doctors/:id/slots?date=YYYY-MM-DD` — available time slots
- [ ] B-48: `POST /medical/appointments` — book appointment
- [ ] B-49: `GET /medical/appointments/my` — my appointments (upcoming + past)
- [ ] B-50: `PATCH /medical/appointments/:id/cancel` — cancel with reason
- [ ] B-51: `PATCH /medical/appointments/:id/reschedule` — change slot
- [ ] B-52: `POST /medical/appointments/:id/rating` — rate doctor after appointment
- [ ] UI-45: Medical home — doctor cards with specialty, next available slot
- [ ] UI-46: Doctor profile — photo, qualifications, schedule, average rating, reviews
- [ ] UI-47: Slot picker — calendar with available slots highlighted
- [ ] UI-48: Booking confirmation screen with add-to-calendar
- [ ] UI-49: My appointments — upcoming + past with status
- [ ] UI-50: Appointment detail — doctor info, time, flat, cancel/reschedule buttons
- [ ] UI-51: Post-appointment rating screen — after appointment time passes

**Proof & Rating:** After appointment completion, resident rates doctor (1-5 stars + optional note). Rating visible on doctor profile. Admin sees appointment fulfillment rate.

---

### F-09: Complaints Management
**Story:** "The lift has been broken for 3 days. I want this escalated, not forgotten."

**Micro-tasks:**
- [ ] B-53: `POST /complaints` — create complaint with category, description, photos, anonymous flag
- [ ] B-54: `GET /complaints/my` — resident's complaints list
- [ ] B-55: `GET /complaints/:id` — complaint detail with status timeline
- [ ] B-56: `POST /complaints/:id/rating` — rate resolution after closure
- [ ] B-57: `POST /complaints/:id/comment` — resident adds follow-up comment
- [ ] B-58: `POST /complaints/:id/escalate` — escalate if unresolved past SLA
- [ ] UI-52: Complaints home — my complaints with status chips
- [ ] UI-53: Raise complaint form — category picker, description, photo attach, anonymous toggle
- [ ] UI-54: Complaint detail — full timeline (Raised → Under Review → Assigned → Resolved → Closed)
- [ ] UI-55: Resolution rating screen — triggered when complaint is closed
- [ ] UI-56: Escalate button — visible after SLA breach (configurable by admin, default 48h)

**Proof & Rating (MANDATORY):** Admin must add resolution note and photo proof before marking RESOLVED. Resident receives notification and rates resolution quality (1-5 stars). Unresolved complaints past SLA auto-escalate.

---

### F-10: Staff Help Requests
**Story:** "I need someone to carry my heavy water cans from the car. I shouldn't have to call anyone."

**Micro-tasks:**
- [ ] B-59: `GET /help-requests/types` — list of available help types
- [ ] B-60: `POST /help-requests` — create help request (type, description, preferred time)
- [ ] B-61: `GET /help-requests/my` — my help request history
- [ ] B-62: `PATCH /help-requests/:id/cancel` — cancel pending request
- [ ] B-63: `POST /help-requests/:id/rating` — rate after completion
- [ ] UI-57: Staff help home — grid of help types (Heavy lifting, Package pickup, Document collection, Escort to car, Grocery help)
- [ ] UI-58: Help request form — type, description, preferred time
- [ ] UI-59: Active request screen — assigned staff name, ETA, contact button
- [ ] UI-60: Rating screen after completion

**Proof & Rating (MANDATORY):** Staff marks complete with a photo. Resident confirms completion and rates (1-5 stars). Non-confirmation after 2 hours auto-confirms.

---

### F-11: Maintenance Payments
**Story:** "I want to pay my dues, see the exact breakdown, and download a proper receipt. Not call the treasurer."

**Micro-tasks:**
- [ ] B-64: `GET /maintenance/bills` — all bills (current, past, overdue)
- [ ] B-65: `GET /maintenance/bills/:id` — bill detail with itemised breakdown
- [ ] B-66: `POST /maintenance/bills/:id/pay` — initiate Razorpay payment
- [ ] B-67: `POST /maintenance/payment/webhook` — Razorpay webhook to update bill status
- [ ] B-68: `GET /maintenance/bills/:id/receipt` — download receipt PDF
- [ ] B-69: `POST /maintenance/auto-pay` — configure auto-pay mandate
- [ ] B-70: `DELETE /maintenance/auto-pay` — cancel auto-pay
- [ ] UI-61: Maintenance home — current dues card, overdue warning banner
- [ ] UI-62: Bill detail — itemised table (base, parking, water, penalty, discount)
- [ ] UI-63: Payment flow — Razorpay WebView/SDK with UPI / Card / Net Banking
- [ ] UI-64: Payment success screen with download receipt button
- [ ] UI-65: Payment history — sorted by date, filterable by year
- [ ] UI-66: Auto-pay setup screen with mandate explanation
- [ ] UI-67: Late payment interest display — transparent calculation shown inline

**Proof & Rating:** Receipt auto-generated on payment success. No rating applicable but admin sees payment compliance rate per resident.

---

### F-12: Property Sale Request
**Story:** "I'm thinking of selling my flat. I want other residents to know first before I go to a broker."

**Micro-tasks:**
- [ ] B-71: `POST /property/listings` — submit listing (flat details, asking price, contact)
- [ ] B-72: `GET /property/listings` — browse all active listings in society
- [ ] B-73: `GET /property/listings/my` — my listings
- [ ] B-74: `POST /property/listings/:id/express-interest` — buyer expresses interest
- [ ] B-75: `PATCH /property/listings/:id/status` — update status (withdraw, mark sold)
- [ ] UI-68: Property listings board — card grid with flat details, price, seller floor
- [ ] UI-69: List my property form — flat number (auto-filled), area, asking price, photos, contact preference
- [ ] UI-70: My listings — with status tracker (Under Review → Listed → Negotiating → Sold)
- [ ] UI-71: Listing detail — full details, interest button, admin-facilitated contact

**Proof & Rating:** Admin facilitates introduction. Seller rates the overall process after closure.

---

### F-13: Travel Mode (Maintenance Pause)
**Story:** "I'm going to my son's house for 2 months. I want newspaper and canteen stopped, and maintenance reduced."

**Micro-tasks:**
- [ ] B-76: `POST /travel-requests` — submit travel pause (start date, return date, services to pause)
- [ ] B-77: `GET /travel-requests/my` — my travel requests
- [ ] B-78: `PATCH /travel-requests/:id/return` — manually mark return
- [ ] B-79: `PATCH /travel-requests/:id/cancel` — cancel pending travel request
- [ ] UI-72: Travel mode home — active travel pause card if any, "Plan Travel" button
- [ ] UI-73: Travel request form — dates, which services to pause (multi-select checklist)
- [ ] UI-74: Pending approval screen — shown while admin reviews
- [ ] UI-75: Return confirmation screen with auto-activation countdown

**Proof & Rating:** N/A (admin-approved administrative process).

---

## Part 2 — 35 New Features (Affluent Senior Citizen Enhancements)

### F-14: Family Emergency Network
**Story:** "My son in Bangalore should know immediately if something happens to me."

**Micro-tasks:**
- [ ] B-80: `POST /family-members` — add family member (name, phone, relationship, permissions)
- [ ] B-81: `GET /family-members` — list my family contacts
- [ ] B-82: `DELETE /family-members/:id` — remove family member
- [ ] B-83: `PATCH /family-members/:id` — update permissions (SOS alerts, visitor notifications, payment alerts)
- [ ] B-84: Family member receives push/SMS when resident triggers SOS
- [ ] B-85: Family member can approve/deny visitor if resident is unreachable (with permission)
- [ ] UI-76: Family network screen — list of contacts with permission toggles
- [ ] UI-77: Add family member form — phone verification, permission checkboxes
- [ ] UI-78: Family member permission settings — SOS Alerts / Visitor Approval / Payment Reminders

**Proof & Rating:** Family member acknowledges SOS notification (logged for admin).

---

### F-15: Medication Reminders
**Story:** "I take 6 medications at different times. I forget."

**Micro-tasks:**
- [ ] B-86: `POST /health/medications` — add medication (name, dosage, frequency, times)
- [ ] B-87: `GET /health/medications` — list my medications
- [ ] B-88: `PUT /health/medications/:id` — update schedule
- [ ] B-89: `DELETE /health/medications/:id` — remove medication
- [ ] B-90: Local push notification scheduler for medication reminders
- [ ] UI-79: Medications list — name, dosage, next reminder time
- [ ] UI-80: Add medication form — name, dosage, frequency picker, time pickers
- [ ] UI-81: Daily medication checklist — check off each dose
- [ ] UI-82: Medication reminder notification — deep-links to checklist

**Proof & Rating:** N/A (personal health tool). Adherence rate visible to resident only.

---

### F-16: Health Vitals Log
**Story:** "My cardiologist wants me to track my BP daily. I want it in one place."

**Micro-tasks:**
- [ ] B-91: `POST /health/vitals` — log vital (type: BP/SUGAR/WEIGHT/SPO2, value, timestamp)
- [ ] B-92: `GET /health/vitals?type=BP&from=DATE&to=DATE` — vitals history
- [ ] B-93: `GET /health/vitals/summary` — latest reading per type
- [ ] UI-83: Vitals home — last reading cards for each type with trend indicator
- [ ] UI-84: Log vital form — type picker, value input, timestamp
- [ ] UI-85: Vitals chart — 7-day and 30-day line graph per metric
- [ ] UI-86: Share vitals — export as PDF for doctor visit

**Proof & Rating:** N/A (personal). Data never shared without explicit consent.

---

### F-17: Health Records Vault
**Story:** "I want all my test reports and prescriptions in the app, not in a folder."

**Micro-tasks:**
- [ ] B-94: `POST /health/records` — upload document (type: PRESCRIPTION/LAB_REPORT/SCAN/VACCINATION, date)
- [ ] B-95: `GET /health/records` — list my health documents
- [ ] B-96: `DELETE /health/records/:id` — delete a record
- [ ] B-97: `GET /health/records/:id/download` — signed URL for download
- [ ] UI-87: Health vault screen — documents grouped by type
- [ ] UI-88: Upload document — pick type, date, photo/PDF picker
- [ ] UI-89: Document viewer — in-app PDF/image viewer
- [ ] UI-90: Share document — generate share link (24h expiry) for doctor

**Proof & Rating:** N/A. Documents encrypted at rest.

---

### F-18: Domestic Help Management
**Story:** "My cook didn't come today and didn't tell me. I want attendance records."

**Micro-tasks:**
- [ ] B-98: `POST /domestic-help` — register domestic help (name, role, phone, photo)
- [ ] B-99: `GET /domestic-help` — list my domestic help
- [ ] B-100: `POST /domestic-help/:id/attendance` — mark present/absent for a date
- [ ] B-101: `GET /domestic-help/:id/attendance?month=YYYY-MM` — attendance history
- [ ] B-102: `POST /domestic-help/:id/salary` — log monthly salary payment
- [ ] B-103: Domestic help automatically created as recurring visitor for gate access
- [ ] UI-91: Domestic help list — cook, maid, driver with today's attendance status
- [ ] UI-92: Add domestic help form — name, role, phone, photo, gate access toggle
- [ ] UI-93: Attendance calendar — monthly view with present/absent dots
- [ ] UI-94: Salary tracker — log payment, running total per month

**Proof & Rating:** Monthly salary payment logs as proof of payment.

---

### F-19: Amenity Booking
**Story:** "I want to reserve the clubhouse for my grandson's birthday. Without calling anyone."

**Micro-tasks:**
- [ ] B-104: `GET /amenities` — list bookable amenities (clubhouse, gym, pool, party hall, guest flat)
- [ ] B-105: `GET /amenities/:id/availability?date=YYYY-MM-DD` — available slots
- [ ] B-106: `POST /amenities/bookings` — book amenity (amenityId, date, slot, guests)
- [ ] B-107: `GET /amenities/bookings/my` — my bookings
- [ ] B-108: `DELETE /amenities/bookings/:id` — cancel booking (refund rules apply)
- [ ] UI-95: Amenities grid — clubhouse, gym, swimming pool, party hall, guest flat
- [ ] UI-96: Amenity detail — photos, capacity, rules, deposit amount
- [ ] UI-97: Slot picker calendar — blocked slots shown in grey
- [ ] UI-98: Booking confirmation with rules acceptance
- [ ] UI-99: My bookings — upcoming and past with cancel button

**Proof & Rating:** After use, resident rates facility cleanliness and staff support (1-5 stars). Admin sees utilization and satisfaction per amenity.

---

### F-20: Concierge Service
**Story:** "I need a taxi to the airport at 4am. I don't want to use a new app."

**Micro-tasks:**
- [ ] B-109: `POST /concierge/requests` — concierge request (type: TAXI/COURIER/PHARMACY/FORM_HELP, details, scheduled time)
- [ ] B-110: `GET /concierge/requests/my` — my concierge request history
- [ ] B-111: `PATCH /concierge/requests/:id/complete` — mark completed with notes
- [ ] B-112: `POST /concierge/requests/:id/rating` — rate concierge staff
- [ ] UI-100: Concierge home — service tiles (Book Taxi, Send Courier, Pharmacy Pickup, Form Help, Other)
- [ ] UI-101: Concierge request form — service type, description, scheduled time, special notes
- [ ] UI-102: Active request tracking — assigned staff, status, contact button
- [ ] UI-103: Concierge history with rating prompt

**Proof & Rating (MANDATORY):** Concierge staff marks complete with delivery photo/confirmation. Resident rates within 24h or auto-confirms.

---

### F-21: Parking Management
**Story:** "A guest is coming with a car. I want them to get a parking slot without drama at the gate."

**Micro-tasks:**
- [ ] B-113: `GET /parking/my` — resident's allocated parking slots
- [ ] B-114: `POST /parking/guest` — request guest parking for a date/time range
- [ ] B-115: `GET /parking/availability` — real-time guest parking availability
- [ ] B-116: `POST /parking/report` — report unauthorized parking in my slot
- [ ] UI-104: Parking screen — my slot number, vehicle registered, guest parking section
- [ ] UI-105: Request guest parking — date, time range, vehicle number of guest
- [ ] UI-106: Guest parking QR — share with guest for gate entry
- [ ] UI-107: Report unauthorized parking — photo + slot number

**Proof & Rating:** N/A. Security verifies and resolves unauthorized parking reports.

---

### F-22: Vehicle Management
**Story:** "I have 2 cars and my son's car also needs access when he visits."

**Micro-tasks:**
- [ ] B-117: `POST /vehicles` — register vehicle (number, type, owner relationship, photo)
- [ ] B-118: `GET /vehicles/my` — my registered vehicles
- [ ] B-119: `DELETE /vehicles/:id` — remove vehicle
- [ ] B-120: `GET /vehicles/entry-log` — my vehicles' gate entry/exit history
- [ ] UI-108: Vehicles screen — list with plate number, type, status (active/removed)
- [ ] UI-109: Add vehicle form — plate, make/model, color, owner relationship
- [ ] UI-110: Entry/exit log — timestamped history

**Proof & Rating:** N/A.

---

### F-23: Society Directory
**Story:** "I forgot which flat the Mehtas moved into. I don't want to ask security."

**Micro-tasks:**
- [ ] B-121: `GET /directory` — opt-in resident directory (name, flat, photo — only opted-in residents visible)
- [ ] B-122: `PUT /profile/directory-visibility` — toggle my directory visibility
- [ ] B-123: `GET /directory/search?q=` — search by name or flat
- [ ] UI-111: Directory screen — alphabetical list with flat numbers
- [ ] UI-112: Resident card — name, flat, phone (if shared), floor
- [ ] UI-113: Directory visibility toggle in profile settings

**Proof & Rating:** N/A. Privacy-first: opt-in only.

---

### F-24: Society AGM & Voting
**Story:** "The AGM is next Sunday. I want to see the agenda and vote on the budget proposal digitally."

**Micro-tasks:**
- [ ] B-124: `GET /agm/meetings` — list of upcoming and past AGMs
- [ ] B-125: `GET /agm/meetings/:id` — agenda, resolutions, documents
- [ ] B-126: `POST /agm/meetings/:id/vote` — cast vote on resolutions (with digital signature)
- [ ] B-127: `GET /agm/meetings/:id/results` — vote results (after meeting)
- [ ] B-128: `POST /agm/meetings/:id/proxy` — assign proxy voter
- [ ] UI-114: AGM screen — meeting cards with date, agenda count, status
- [ ] UI-115: Meeting detail — agenda items, attached PDFs, vote buttons
- [ ] UI-116: Resolution voting — For / Against / Abstain with confirmation
- [ ] UI-117: Proxy assignment — enter flat number of proxy voter

**Proof & Rating:** N/A. Vote receipts downloadable.

---

### F-25: NOC & Document Requests
**Story:** "I need a NOC from the society for my bank loan. I want to apply digitally."

**Micro-tasks:**
- [ ] B-129: `POST /document-requests` — request NOC / Ownership Certificate / Payment Certificate
- [ ] B-130: `GET /document-requests/my` — my document requests with status
- [ ] B-131: `GET /document-requests/:id/download` — download approved document
- [ ] UI-118: Document requests screen — list of request types
- [ ] UI-119: Request form — document type, purpose, required by date
- [ ] UI-120: Status tracker — Submitted → Under Review → Ready → Downloaded

**Proof & Rating:** Admin digitally signs the document. Resident rates processing speed after download.

---

### F-26: Newspaper & Milk Subscription Management
**Story:** "I want 2 newspapers and a litre of milk every morning. And pause it when I travel."

**Micro-tasks:**
- [ ] B-132: `GET /subscriptions/vendors` — society-empanelled vendors (newspaper, milk, etc.)
- [ ] B-133: `POST /subscriptions` — subscribe to vendor delivery
- [ ] B-134: `GET /subscriptions/my` — my active subscriptions
- [ ] B-135: `PATCH /subscriptions/:id/pause` — pause with date range
- [ ] B-136: `PATCH /subscriptions/:id/cancel` — cancel subscription
- [ ] UI-121: Subscriptions screen — active subscriptions with vendor logo, item, frequency
- [ ] UI-122: Subscribe form — vendor, items, quantity, start date
- [ ] UI-123: Pause/cancel controls per subscription

**Proof & Rating:** N/A. Admin-managed delivery vendors.

---

### F-27: Lift & Infrastructure Status
**Story:** "I'm on the 12th floor. If the lift is down, I need to know before I leave my flat."

**Micro-tasks:**
- [ ] B-137: `GET /infrastructure/status` — real-time status of lifts, power backup, water supply
- [ ] B-138: `POST /infrastructure/report` — report infrastructure issue (lift stuck, water dry, etc.)
- [ ] B-139: Push notification when lift status changes (admin broadcasts)
- [ ] UI-124: Infrastructure status screen — lift (operational/maintenance/stuck), power (main/backup), water (supply/dry)
- [ ] UI-125: Report issue — select infrastructure item, describe issue, optional photo
- [ ] UI-126: Status history — last 7 days of events per item

**Proof & Rating:** Admin marks issue resolved. Resident rates response time.

---

### F-28: Water Supply & Utility Alerts
**Story:** "The water supply is off without notice. I want advance alerts."

*(Covered as sub-module within F-27 Infrastructure. Dedicated push notification channel for water/power alerts.)*

- [ ] B-140: `POST /admin/infrastructure/alert` — admin broadcasts utility alert (water off, power maintenance)
- [ ] UI-127: Utility alerts notification channel — separate from general notices, always loud

---

### F-29: Laundry Service
**Story:** "I want to send my dry-cleaning without going out."

**Micro-tasks:**
- [ ] B-141: `POST /laundry/requests` — request pickup (items description, preferred time)
- [ ] B-142: `GET /laundry/requests/my` — history
- [ ] B-143: `PATCH /laundry/requests/:id/status` — status updates by staff (Picked Up → Processing → Ready → Delivered)
- [ ] B-144: `POST /laundry/requests/:id/rating` — rate service
- [ ] UI-128: Laundry screen — "Schedule Pickup" button, active request card, history
- [ ] UI-129: Pickup form — description, garment count, special instructions, preferred time
- [ ] UI-130: Live status tracker — pickup time, estimated ready time

**Proof & Rating (MANDATORY):** Photo of received garments at pickup. Photo at delivery. Resident confirms and rates.

---

### F-30: Package & Parcel Management
**Story:** "A package arrived but I was asleep. I want a notification and to know where it is."

**Micro-tasks:**
- [ ] B-145: `POST /packages` — gate/reception logs incoming package (courier, tracking no, photo)
- [ ] B-146: `GET /packages/my` — my pending and collected packages
- [ ] B-147: `PATCH /packages/:id/collected` — mark collected with resident confirmation
- [ ] B-148: Push notification when package arrives
- [ ] UI-131: Packages screen — pending collections with courier, arrival time, photo
- [ ] UI-132: Package detail — photo, dimensions, courier contact
- [ ] UI-133: Collection confirmation — resident taps "I collected this"

**Proof & Rating:** N/A. Security logs delivery as proof.

---

### F-31: Housekeeping & Common Area Requests
**Story:** "The corridor on my floor hasn't been cleaned for 2 days."

**Micro-tasks:**
- [ ] B-149: `POST /housekeeping/requests` — request specific area cleaning (corridor, lobby, terrace)
- [ ] B-150: `GET /housekeeping/schedule` — society cleaning schedule by area and day
- [ ] B-151: `POST /housekeeping/requests/:id/rating` — rate after completion
- [ ] UI-134: Housekeeping screen — today's schedule, request extra cleaning button
- [ ] UI-135: Request form — area, urgency, description
- [ ] UI-136: Rating screen post-completion

**Proof & Rating (MANDATORY):** Staff uploads before/after photos. Resident rates.

---

### F-32: Pest Control Schedule
**Story:** "Pest control is next Thursday. I want to know which flats/areas and whether I need to vacate."

**Micro-tasks:**
- [ ] B-152: `GET /pest-control/schedule` — upcoming and past schedules
- [ ] B-153: `POST /pest-control/opt-out` — opt out of flat treatment with reason
- [ ] UI-137: Pest control screen — schedule cards with area, type, date
- [ ] UI-138: Flat-level treatment confirmation or opt-out

**Proof & Rating:** N/A. Admin-managed.

---

### F-33: Garden & Common Area Updates
**Story:** "The rooftop garden was renovated. I'd like to see photos and know when it reopens."

**Micro-tasks:**
- [ ] B-154: `GET /community/updates` — community area updates (notices with photo galleries)
- [ ] UI-139: Community updates feed — photo-forward card list

**Proof & Rating:** N/A. Admin publishes updates.

---

### F-34: Biometric & Voice Login
**Story:** "I don't want to type a password every time."

**Micro-tasks:**
- [ ] UI-140: Biometric login on app open — Face ID / fingerprint with expo-local-authentication
- [ ] UI-141: Biometric setup screen in Profile → Security Settings
- [ ] UI-142: Fallback PIN entry (4-digit) if biometric fails
- [ ] UI-143: Voice command launch integration (Phase 2 — "Hey Marzi")

**Proof & Rating:** N/A. Security feature.

---

### F-35: Accessibility Mode
**Story:** "The text is too small and my fingers aren't as precise as they used to be."

**Micro-tasks:**
- [ ] UI-144: Font size slider in settings (Small / Medium / Large / Extra Large)
- [ ] UI-145: High contrast mode toggle
- [ ] UI-146: Haptic feedback toggle (on/off)
- [ ] UI-147: Minimum touch target: 48x48dp enforced on all interactive elements
- [ ] UI-148: Screen reader (VoiceOver/TalkBack) labels on all icons and buttons

**Proof & Rating:** N/A. Accessibility compliance.

---

### F-36: WhatsApp & SMS Fallback Notifications
**Story:** "I sometimes miss app notifications. Can important things come on WhatsApp too?"

**Micro-tasks:**
- [ ] B-155: `POST /notification-preferences` — set channel per category (PUSH/WHATSAPP/SMS/EMAIL)
- [ ] B-156: WhatsApp Business API integration for critical alerts (SOS dispatch, visitor arrival, payment due)
- [ ] UI-149: Notification preferences screen — per-category channel toggles
- [ ] UI-150: WhatsApp opt-in flow — "Link WhatsApp" button in settings

**Proof & Rating:** N/A. Infrastructure.

---

### F-37: Digital Wallet / Prepaid Balance
**Story:** "I want to top up a balance and let it auto-deduct for maintenance, canteen, and services."

**Micro-tasks:**
- [ ] B-157: `POST /wallet/topup` — add funds to society wallet
- [ ] B-158: `GET /wallet/balance` — current balance + transaction history
- [ ] B-159: Auto-deduct from wallet for canteen pre-orders and service charges
- [ ] UI-151: Wallet card on home screen — balance, top-up button
- [ ] UI-152: Wallet transactions — full history with auto-deductions

**Proof & Rating:** N/A. Financial feature.

---

### F-38: Community Social Board
**Story:** "I want to share my garden photos with neighbors. Just in our building, not on Facebook."

**Micro-tasks:**
- [ ] B-160: `POST /community/posts` — resident creates post (text + photos)
- [ ] B-161: `GET /community/posts` — community feed (paginated)
- [ ] B-162: `POST /community/posts/:id/react` — like/heart
- [ ] B-163: `POST /community/posts/:id/comments` — comment
- [ ] B-164: Admin moderation — report and remove inappropriate posts
- [ ] UI-153: Community board screen — photo-first feed
- [ ] UI-154: Create post — text + photo picker
- [ ] UI-155: Post detail with comments

**Proof & Rating:** N/A. Social feature.

---

### F-39: Emergency Broadcast from Resident
**Story:** "I see fire smoke coming from flat 402. I want to alert everyone on my floor immediately."

**Micro-tasks:**
- [ ] B-165: `POST /alerts/broadcast` — resident sends building-wide or floor-level alert (admin approves before broadcast, or immediate for fire/security)
- [ ] UI-156: Emergency broadcast button in security section
- [ ] UI-157: Alert type picker — Fire / Medical / Security / Other

**Proof & Rating:** N/A.

---

### F-40: Maintenance Request History Export
**Story:** "I need a record of all repairs done in my flat for insurance purposes."

**Micro-tasks:**
- [ ] B-166: `GET /service-requests/export?format=PDF` — export all service requests with photos for flat
- [ ] UI-158: Export button on service request history screen
- [ ] UI-159: Date range selector for export

**Proof & Rating:** N/A. Utility.

---

### F-41: Night Security Check-In Confirmation
**Story:** "I feel safer knowing the night guard actually did their rounds."

**Micro-tasks:**
- [ ] B-167: `GET /security/rounds` — log of completed security rounds with timestamps
- [ ] UI-160: Security rounds screen — nightly round confirmations visible to residents

**Proof & Rating:** Security staff confirms each round with QR scan at checkpoints.

---

### F-42: Visitor Photo Verification (KYC)
**Story:** "I approved a visitor but I want to see a photo before they enter."

**Micro-tasks:**
- [ ] B-168: `POST /visitors/:id/photo` — gate staff uploads visitor photo at entry
- [ ] B-169: Resident receives photo with "Approve entry" / "Deny entry" notification
- [ ] UI-161: Visitor arrival notification with photo card and action buttons

**Proof & Rating:** Photo logged as entry proof.

---

### F-43: Flat Rental Management (Owner-Tenant)
**Story:** "I rent out flat 3B. I want the tenant's maintenance reflected separately."

**Micro-tasks:**
- [ ] B-170: `POST /flats/:id/tenant` — owner registers tenant
- [ ] B-171: `GET /flats/:id/tenant` — current tenant details
- [ ] B-172: Tenant gets sub-access to services (limited permissions)
- [ ] UI-162: Tenant management screen (visible to flat owners)
- [ ] UI-163: Tenant profile — contact, move-in date, lease end date

**Proof & Rating:** N/A.

---

### F-44: Society Budget Transparency
**Story:** "Where does my maintenance money go? I want to see the society's expense breakdown."

**Micro-tasks:**
- [ ] B-173: `GET /society/budget` — admin-published monthly expense summary (salaries, utilities, maintenance, events)
- [ ] B-174: `GET /society/budget/:month` — specific month breakdown
- [ ] UI-164: Budget transparency screen — pie chart + line items
- [ ] UI-165: Month selector — last 12 months of published budgets

**Proof & Rating:** N/A. Transparency feature.

---

### F-45: Smart Home Integration (Phase 2)
**Story:** "I want to unlock my door for the plumber directly from the app without being present."

**Micro-tasks:**
- [ ] B-175: `POST /smart-home/unlock` — temporary unlock for authorized visitor (if smart lock installed)
- [ ] B-176: `GET /smart-home/access-log` — door unlock history
- [ ] UI-166: Smart home card on home screen (only if integration enabled)

**Proof & Rating:** N/A. Hardware-dependent.

---

### F-46: Grocery & Pharmacy Delivery (Empanelled Vendors)
**Story:** "I need my medications from the society's empanelled pharmacy, delivered to my door."

**Micro-tasks:**
- [ ] B-177: `GET /vendors` — society-empanelled vendor list (pharmacy, grocery, florist)
- [ ] B-178: `POST /vendor-orders` — place order with vendor (items, notes, delivery slot)
- [ ] B-179: `GET /vendor-orders/my` — my orders + tracking
- [ ] B-180: `POST /vendor-orders/:id/rating` — rate vendor service
- [ ] UI-167: Vendors screen — empanelled vendor cards
- [ ] UI-168: Order form — items, quantity, notes, preferred delivery slot
- [ ] UI-169: Order tracking — Placed → Confirmed → Dispatched → Delivered

**Proof & Rating (MANDATORY):** Vendor marks delivered with photo. Resident confirms and rates.

---

### F-47: Society Rules & Bylaws
**Story:** "Can pets be kept in flats? I want to check the official rules."

**Micro-tasks:**
- [ ] B-181: `GET /society/bylaws` — society rules and bylaws (admin-maintained)
- [ ] UI-170: Bylaws screen — searchable list of rules by category

**Proof & Rating:** N/A.

---

### F-48: Feedback to Management
**Story:** "I have a suggestion to improve the gate security process."

**Micro-tasks:**
- [ ] B-182: `POST /feedback` — general feedback to management (category, message, anonymous option)
- [ ] B-183: `GET /feedback/my` — my feedback history with responses
- [ ] UI-171: Feedback screen — category, message, anonymous toggle
- [ ] UI-172: Feedback history — submitted items with admin replies

**Proof & Rating:** Admin must acknowledge every feedback within 7 days. Resident rates responsiveness.

---

### Summary: All Services Must End With Proof + Rating

| Feature | Proof Required | Rating Required |
|---|---|---|
| Service Request (Plumber, etc.) | Staff uploads before/after photos | Yes — 1-5 stars + text, mandatory |
| Complaints | Admin adds resolution note + photo | Yes — resolution quality rating |
| Staff Help Request | Staff photo at completion | Yes — 1-5 stars |
| Medical Appointment | N/A | Yes — doctor rating |
| Canteen Dishes | N/A | Yes — per-dish after meal window |
| Events | N/A | Yes — post-event within 24h |
| Amenity Booking | N/A | Yes — facility + staff |
| Laundry | Pickup + delivery photos | Yes — garment quality |
| Concierge | Delivery confirmation photo | Yes — staff rating |
| Housekeeping | Before/after photos | Yes — cleanliness rating |
| Vendor Orders | Delivery photo | Yes — vendor rating |
| Gate Entry Experience | Security staff logged entry | Optional — gate staff |
| NOC/Document Request | Admin-signed doc | Yes — processing speed |
| Visitor Arrival | Gate photo | Optional |

---

## Part 3 — Implementation Task Backlog (By Domain)

### Backend Tasks (B-001 to B-183 + infrastructure)
All mapped above per feature. Key missing backend items:
- Amenity booking module (Prisma model + CRUD + availability)
- Family member module
- Health module (vitals + medications + records)
- Domestic help module
- Parking module
- Vehicle management module
- Wallet module
- Community posts module
- AGM/voting module
- Document requests module
- Subscriptions module
- Infrastructure status module
- Laundry module
- Package management module
- Concierge module
- Vendor management module
- Feedback module

### Resident App UI Tasks (UI-001 to UI-172)
All mapped above per feature. Key screens missing:
- Canteen (index, dish detail)
- Medical (doctor list, slot picker, booking, appointments)
- Family network
- Medication reminders
- Vitals log
- Health records vault
- Domestic help
- Amenity booking
- Parking
- Vehicle management
- Directory
- AGM & voting
- Document requests
- Subscriptions (newspaper, milk)
- Infrastructure status
- Laundry
- Packages
- Housekeeping requests
- Concierge
- Wallet
- Community board
- Budget transparency

### Admin Web Tasks
- Canteen management page (create/edit menus and dishes)
- Medical administration (manage doctors, schedules, SOS log)
- Amenity management (create amenities, view bookings)
- AGM management (create meetings, resolutions, publish results)
- Infrastructure status management (set lift/power/water status)
- Laundry vendor management
- Vendor management (empanelled vendors)
- Budget publication (monthly expense summary)
- Document request processing
- Community posts moderation
- SOS response analytics dashboard
- Staff performance leaderboard
- Resident directory management
- Travel pause processing

### Staff App Tasks
- Proof of work photo upload (before/after)
- Service request completion flow
- Help request acceptance and completion
- Laundry pickup/delivery confirmation
- Package reception logging
- Security rounds QR check-in
- Housekeeping task completion with photos
- Ratings received view
- Concierge task management

---

*Last updated: 2026-04-30*
*Persona: Affluent Senior Citizen (65-80+, apartment owner)*
