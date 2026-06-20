# App notification coverage (resident & staff)

Push engine: `backend/src/common/notification/push.service.ts`.

- `push.send(userId, { title, body, category, critical?, collapseKey?, actions?, dataOnly? }, data?)` — single user.
- `push.sendToSociety(societyId, role | null, notification, data?)` — fan-out to a role.
- Every send also persists to `NotificationLog` (the in-app inbox) and respects opt-out + quiet hours (unless `critical`).
- `category` must be a key from `notification-categories.ts`. `data` values must be strings.
- Always fire-and-forget: `void this.push.send(...).catch((e) => this.logger.warn(...))`. Never block the request.
- `PushModule` is `@Global()`; just inject `private push: PushService` in the service constructor.

Category keys: `visitors_gate`, `deliveries`, `daily_help`, `family_vehicle`, `complaints`,
`notices`, `notices_urgent`, `community`, `payments_dues`, `emergency_sos`, `staff_tasks`,
`approval_results`, `account_auth`.

**Status legend:**

- ✅ **pre-existing** — was already wired before this work.
- 🆕 **added** — wired in this change (and unit-tested).
- ❌ **not done** — not implemented; reason in the Notes column.

## Residents

| Module           | Event                          | Status | Category                   | data.type                  | Notes                                                        |
| ---------------- | ------------------------------ | ------ | -------------------------- | -------------------------- | ------------------------------------------------------------ |
| visitor          | arrival / approval / decision  | ✅     | visitors_gate / deliveries | VISITOR\_\*                | Heads-up + action buttons — see "Visitor UX" note below      |
| complaint        | status changed                 | ✅     | complaints                 | COMPLAINT_UPDATED          |                                                              |
| notice           | emergency broadcast            | ✅     | notices_urgent             | NOTICE_URGENT              | critical; bypasses quiet hours                               |
| resident         | onboarding approved / rejected | ✅     | account_auth               | RESIDENT_APPROVED/REJECTED |                                                              |
| notice           | normal notice published        | 🆕     | notices                    | NOTICE_PUBLISHED           | society RESIDENT broadcast; emergency path unchanged         |
| service-request  | created (ack)                  | 🆕     | complaints                 | SERVICE_REQUEST_CREATED    |                                                              |
| service-request  | assigned                       | 🆕     | complaints                 | SERVICE_REQUEST_ASSIGNED   |                                                              |
| service-request  | completed (+ rate prompt)      | 🆕     | complaints                 | SERVICE_REQUEST_COMPLETED  | rate prompt folded into completion (no separate status)      |
| maintenance      | bill generated                 | 🆕     | payments_dues              | BILL_GENERATED             | in `admin.service.generateBills`                             |
| maintenance      | payment received               | 🆕     | payments_dues              | PAYMENT_RECEIVED           | verifyPayment + Razorpay webhook                             |
| maintenance      | payment failed                 | 🆕     | payments_dues              | PAYMENT_FAILED             | webhook failed branch                                        |
| maintenance      | bill overdue                   | ❌     | payments_dues              | —                          | overdue computed on read; no job writes OVERDUE — needs cron |
| package          | parcel arrived                 | 🆕     | deliveries                 | PACKAGE_ARRIVED            | was realtime-socket-only                                     |
| package          | parcel collected               | 🆕     | deliveries                 | PACKAGE_COLLECTED          |                                                              |
| amenity          | booking confirmed              | 🆕     | community                  | AMENITY_BOOKING_CONFIRMED  |                                                              |
| amenity          | booking cancelled              | 🆕     | community                  | AMENITY_BOOKING_CANCELLED  |                                                              |
| amenity          | booking reminder               | ❌     | community                  | —                          | no scheduler — needs cron                                    |
| event            | created                        | 🆕     | community                  | EVENT_CREATED              | society RESIDENT broadcast                                   |
| event            | cancelled                      | 🆕     | community                  | EVENT_CANCELLED            | loops registrations                                          |
| event            | waitlist promoted              | 🆕     | community                  | EVENT_WAITLIST_PROMOTED    | was silent                                                   |
| event            | reminder                       | ❌     | community                  | —                          | no scheduler — needs cron                                    |
| medical          | appointment confirmed          | 🆕     | community                  | APPOINTMENT_CONFIRMED      |                                                              |
| medical          | appointment cancelled          | 🆕     | community                  | APPOINTMENT_CANCELLED      |                                                              |
| medical          | appointment rescheduled        | 🆕     | community                  | APPOINTMENT_RESCHEDULED    |                                                              |
| medical          | appointment reminder           | ❌     | community                  | —                          | no scheduler — needs cron                                    |
| document-request | verified (approved)            | 🆕     | account_auth               | DOCUMENT_VERIFIED          |                                                              |
| document-request | rejected                       | 🆕     | account_auth               | DOCUMENT_REJECTED          |                                                              |
| wallet           | credited                       | 🆕     | payments_dues              | WALLET_CREDITED            | topUp / verifyTopupAndCredit / refund                        |
| wallet           | debited                        | 🆕     | payments_dues              | WALLET_DEBITED             | deduct / deductForMaintenance                                |
| laundry          | ready / picked up / cancelled  | 🆕     | daily_help                 | LAUNDRY\_\*                |                                                              |
| canteen          | order ready / collected        | 🆕     | daily_help                 | CANTEEN\_\*                |                                                              |
| housekeeping     | scheduled / completed          | 🆕     | daily_help                 | HOUSEKEEPING\_\*           |                                                              |
| concierge        | request updated / completed    | 🆕     | daily_help                 | CONCIERGE\_\*              |                                                              |
| community        | comment on own post            | 🆕     | community                  | COMMUNITY_COMMENT          | skips self-comment                                           |
| community        | like on own post               | 🆕     | community                  | COMMUNITY_REACTION         | via `toggleLike` (carries actor)                             |
| community        | reaction via `reactToPost`     | ❌     | community                  | —                          | that overload carries no actor id; only `toggleLike` wired   |

## Staff

| Area            | Event                             | Status | Target              | Category         | data.type               | Notes                                              |
| --------------- | --------------------------------- | ------ | ------------------- | ---------------- | ----------------------- | -------------------------------------------------- |
| visitor         | resident decision relayed to gate | ✅     | staff               | approval_results | VISITOR_DECISION        |                                                    |
| service-request | scheduled-visit reminder          | ✅     | staff (assignee)    | staff_tasks      | SR_REMINDER             | existing cron                                      |
| service-request | task assigned                     | 🆕     | staff (assignee)    | staff_tasks      | TASK_ASSIGNED           | was realtime-socket-only                           |
| sos             | SOS raised                        | 🆕     | role STAFF (guards) | emergency_sos    | SOS_TRIGGERED           | critical; ADMIN push pre-existing & retained       |
| staff / leave   | leave approved / rejected         | 🆕     | staff               | account_auth     | LEAVE_APPROVED/REJECTED |                                                    |
| staff           | dismissed / offboarded            | 🆕     | staff               | account_auth     | STAFF_DISMISSED         | sent after soft-deactivate so token still resolves |
| staff           | salary slip published             | ❌     | staff               | payments_dues    | —                       | read-only today; no publish endpoint               |
| staff           | document verified / rejected      | ❌     | staff               | account_auth     | —                       | read-only today; no admin verify endpoint          |

## Not done — summary (revisit later)

These need a backend write path or a scheduler that doesn't exist yet:

- **Bill overdue** — add a cron that flips PENDING→OVERDUE and notifies.
- **Amenity / event / medical reminders** — add a reminder scheduler (BullMQ / cron).
- **Salary slip published, staff document verified/rejected** — currently read-only; add the publish/verify endpoints first.
- **Pest control** — `PestControlSchedule` is society-wide with no resident link, so there is no per-resident target.
- **`reactToPost` overload** — only the actor-aware `toggleLike` path notifies.

## Visitor UX note (not full-screen / call-style)

The visitor-approval push is **high-priority heads-up with Approve/Reject buttons** — it is **not** a full-screen, screen-waking, call-style notification like MyGate/NoBrokerHood.

- Backend sends it data-only (`actions` present) with Android `priority: high` and iOS `interruption-level: time-sensitive` — **no `fullScreenIntent`**.
- The resident app uses `expo-notifications` only (no `notifee` / `@react-native-firebase/messaging` / CallKeep), and has **no background data-message handler**, so on Android in background/killed state the action buttons (and possibly the notification) do not reliably render. `USE_FULL_SCREEN_INTENT` is not declared.
- To make it MyGate-style: add `@notifee/react-native` + `@react-native-firebase/messaging`, a `setBackgroundMessageHandler` that calls `notifee.displayNotification` with `android.fullScreenAction` + action buttons, a full-screen `showWhenLocked`/`turnScreenOn` Activity, the `USE_FULL_SCREEN_INTENT` permission, and a full-screen flag on the backend payload. (Tracked separately — not part of this change.)

## Out of scope

- WhatsApp / SMS / email channels (push + in-app inbox only).
- admin-web receive UI (send-only by design).
