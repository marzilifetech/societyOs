# App Feedback — 19 June 2026

Source: [Notion — App feedback 19th June](https://www.notion.so/App-feedback-19th-June-3844cd16075c80999907cbc604623955)  
PDF export in repo is blank (Safari print captured headers only); items below verified from Notion page.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `P0` ship-blocker · `P1` important · `P2` polish

---

## Summary by area

| Area                                                        | Priority | Owner agent | Status |
| ----------------------------------------------------------- | -------- | ----------- | ------ |
| Backend (medical routes, events, complaints enum)           | P0       | Agent A     | `[x]`  |
| Visitor + Medical + SOS + Signup                            | P0       | Agent B     | `[x]`  |
| Canteen + Payments + Complaints + Home UI                   | P1       | Agent C     | `[x]`  |
| Travel/Property Coming Soon + Concierge + Services + Events | P1       | Agent D     | `[x]`  |

---

## 1. Visitor Tab

### 1.1 Move "Purpose of Visit" to staff app `[P0]`

- [ ] **Resident:** Remove `Purpose of Visit` field from `apps/resident-app/app/visitor/new.tsx` and stop sending `purpose` in POST `/visitors` payload (field remains optional on backend).
- [ ] **Staff:** Add `Purpose of Visit` input to `apps/staff-app/app/entry/new.tsx` (guest flow) and pass `purpose` in POST `/visitors/at-gate` (DTO already supports it).
- [ ] Verify staff scan/detail screens still display purpose when present.

### 1.2 Photo submit UX after camera `[P1]`

- [ ] **Resident:** In `visitor/new.tsx`, set `allowsEditing: false` on camera/gallery picker (match staff app) OR document that crop = confirm; user expects explicit submit, not forced crop.
- [ ] Confirm retake/remove flow still works after change.

---

## 2. Medical Tab

### 2.1 Book Appointment — hide past slots for today `[P0]`

- [ ] **Backend (optional):** Filter past slots in `medical.service.ts` `getSlots()` when `date` is today.
- [ ] **Resident:** Filter slots client-side in `apps/resident-app/app/medical/book.tsx` for selected date = today.
- [ ] **Services:** Apply same filter in `apps/resident-app/app/services/new.tsx` `TIME_SLOTS` when selected day is today.

### 2.2 My Appointments — "Failed to load appointments" `[P0]`

- [ ] **Root cause:** NestJS route order — `GET medical/appointments/:id` matches `mine` before `GET medical/appointments/mine`.
- [ ] **Backend:** Move `@Get('appointments/mine')` **above** `@Get('appointments/:id')` in `backend/src/modules/medical/medical.controller.ts`.
- [ ] **Resident (belt-and-suspenders):** Fallback query to `/medical/appointments` in `apps/resident-app/app/medical/appointments/index.tsx`.
- [ ] Add/adjust test if controller spec exists.

---

## 3. Canteen

### 3.1 Pre-order — "Something went wrong" (ErrorBoundary crash) `[P0]`

- [ ] Reproduce: open `apps/resident-app/app/canteen/pre-order.tsx`.
- [ ] Fix render crash (likely invalid Ionicon name, Decimal price arithmetic, or order `items` shape mismatch in `MyOrdersView`).
- [ ] Normalize `dish.price` with `Number()` in cart totals.
- [ ] Map `listPreOrders` JSON items `{ dishId, name, quantity, unitPrice }` in UI (not `{ dish: Dish }`).
- [ ] Verify POST `/canteen/pre-orders` with valid `pickupAt` ISO datetime.

---

## 4. Payments

### 4.1 Auto-pay should prompt for payment method `[P1]`

- [ ] **Resident:** In `apps/resident-app/app/maintenance/index.tsx`, when enabling auto-pay:
  - If no saved payment method, show Alert/modal to add card or navigate to payment flow.
  - If methods exist, show which method will be charged.
- [ ] Wire to backend if `/maintenance/payment-methods` or similar exists; otherwise stub UI with clear "Add payment method" CTA.

---

## 5. Complaints

### 5.1 Quick Actions icon alignment `[P2]`

- [ ] Fix grid alignment in `apps/resident-app/app/(tabs)/index.tsx` Quick Actions (Complaints icon misaligned — use consistent `IconCircle` size, card minHeight, `alignItems: 'center'`).

### 5.2 Back navigation bug `[P1]`

- [ ] Investigate: back from home sometimes lands on complaints after visiting complaints 2–3 times.
- [ ] Check stack history / `router.back()` vs `router.replace` in complaints flow (`complaints/new.tsx` success uses `router.replace`).
- [ ] Prefer `router.replace` or explicit home route on success sheets.

### 5.3 Community complaints (not just apartment) `[P1]`

- [ ] Add `COMMUNITY` to `ComplaintCategory` enum in `backend/src/modules/complaint/dto/complaint.dto.ts` (+ migration if Prisma enum).
- [ ] Add "Community" category tile in `apps/resident-app/app/complaints/index.tsx` and map in `complaints/new.tsx` `CATEGORY_ENUM`.

---

## 6. Travel

### 6.1 Coming Soon placeholder `[P1]`

- [ ] Replace `apps/resident-app/app/travel/index.tsx` body with shared `ComingSoonScreen` ("Travel pause isn't available in your community yet").
- [ ] Update home Quick Action label/route or show coming-soon on navigate.

---

## 7. Property

### 7.1 Coming Soon placeholder `[P1]`

- [ ] Replace `apps/resident-app/app/property/index.tsx` with `ComingSoonScreen`.
- [ ] Keep route stable for nav; no broken deep links.

---

## 8. Staff Help → Concierge

### 8.1 Link resident app to admin Concierge `[P0]`

- [ ] Rename user-facing "Staff Help" → **"Concierge"** in home, profile, screen headers.
- [ ] Switch API from `/help-requests` to `/concierge` (POST create, GET `/concierge/my` or `/concierge-requests`).
- [ ] Map `category` → concierge `type` in `help-requests/new.tsx` and list/detail screens.
- [ ] Admin already at `apps/admin-web/src/app/(authed)/concierge/page.tsx` — verify end-to-end.

---

## 9. Services

### 9.1 Remove Pest Control `[P1]`

- [ ] Remove from `CATEGORIES` in `apps/resident-app/app/(tabs)/services.tsx`.

### 9.2 Book appointment time slots `[P0]`

- [ ] Same past-slot filter as Medical §2.1.

---

## 10. Events

### 10.1 Admin-created events not showing in resident app `[P0]`

- [ ] Verify admin POST `/events` sets `status: 'PUBLISHED'` and correct `societyId`.
- [ ] **Backend:** `getEvents()` should not throw when resident row missing — use `findResidentByUserId` + null-safe `myRegistration`.
- [ ] **Resident:** Handle `isError` in `apps/resident-app/app/events/index.tsx` (show retry, not empty state).
- [ ] Confirm `(tabs)/events.tsx` re-exports events list.

---

## 11. Emergency SOS

### 11.1 Send Alert button hidden / layout `[P0]`

- [ ] Reduce beacon size or make form scrollable with footer always visible in `apps/resident-app/app/medical/sos.tsx`.
- [ ] Use `ScrollView` + sticky footer; test on small screens / safe area.

### 11.2 Location permission at signup, not on alert `[P1]`

- [ ] Request foreground location during onboarding (`profile-setup.tsx` or `documents.tsx`) with explanation.
- [ ] SOS trigger: use cached permission; don't first-request on send.

---

## 12. Signup

### 12.1 Allow bypass biometrics `[P1]`

- [ ] `otp-verify.tsx`: ensure "Not now" on biometric Alert doesn't block navigation.
- [ ] `phone-entry.tsx`: biometric auto-prompt must not block phone entry if cancelled/failed.

### 12.2 Mandatory info instead of "Under Review" first `[P1]`

- [ ] After OTP for new users: route to `profile-setup` before `pending-approval`.
- [ ] `pending-approval.tsx`: lead with "Complete Home Details" / documents, de-emphasize passive waiting copy when `needsSetup`.

---

## Shared components to add

- [ ] `apps/resident-app/src/components/ComingSoonScreen.tsx` — reusable placeholder.
- [ ] `apps/resident-app/src/lib/time-slots.ts` — `filterPastSlots(slots, dateIso)` helper shared by medical + services.

---

## Verification checklist

- [ ] Backend: `pnpm --filter backend test` (medical controller if touched)
- [ ] Resident: typecheck `apps/resident-app`
- [ ] Manual smoke: appointments list, book slot (today), pre-order, events list, SOS footer visible, concierge create → admin list
- [ ] Staff: at-gate entry with purpose field

---

## Notes / known root causes

1. **Appointments 404:** Route shadowing `appointments/mine` → `appointments/:id`.
2. **Events empty on error:** `requireResidentByUserId` throw in `event.service.getEvents`.
3. **PDF blank:** Notion content requires live page; use this doc + Notion URL for future exports.
