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

Legend: ✅ already wired · ➕ added in this work · ⬜ intentionally out of scope.

## Residents

| Module           | Event                                              | Status | Target             | Category                   | data.type                  |
| ---------------- | -------------------------------------------------- | ------ | ------------------ | -------------------------- | -------------------------- |
| visitor          | arrival / approval / decision                      | ✅     | resident           | visitors_gate / deliveries | VISITOR\_\*                |
| complaint        | status changed                                     | ✅     | resident           | complaints                 | COMPLAINT_UPDATED          |
| notice           | emergency broadcast                                | ✅     | society RESIDENT   | notices_urgent             | NOTICE_URGENT              |
| resident         | onboarding approved / rejected                     | ✅     | resident           | account_auth               | RESIDENT_APPROVED/REJECTED |
| notice           | normal notice published                            | ➕     | society RESIDENT   | notices                    | NOTICE_PUBLISHED           |
| service-request  | created (ack)                                      | ➕     | resident           | complaints                 | SERVICE_REQUEST_CREATED    |
| service-request  | assigned                                           | ➕     | resident           | complaints                 | SERVICE_REQUEST_ASSIGNED   |
| service-request  | completed                                          | ➕     | resident           | complaints                 | SERVICE_REQUEST_COMPLETED  |
| service-request  | awaiting rating                                    | ➕     | resident           | complaints                 | SERVICE_REQUEST_RATE       |
| maintenance      | bill generated                                     | ➕     | resident           | payments_dues              | BILL_GENERATED             |
| maintenance      | payment received                                   | ➕     | resident           | payments_dues              | PAYMENT_RECEIVED           |
| maintenance      | payment failed                                     | ➕     | resident           | payments_dues              | PAYMENT_FAILED             |
| maintenance      | bill overdue                                       | ➕     | resident           | payments_dues              | BILL_OVERDUE               |
| package          | parcel arrived / collected                         | ➕     | resident           | deliveries                 | PACKAGE_ARRIVED/COLLECTED  |
| amenity          | booking confirmed / cancelled / reminder           | ➕     | resident           | community                  | AMENITY\_\*                |
| event            | created / reminder / cancelled / waitlist-promoted | ➕     | resident / society | community                  | EVENT\_\*                  |
| medical          | appointment confirmed / reminder / cancelled       | ➕     | resident           | community                  | APPOINTMENT\_\*            |
| document-request | verified / rejected                                | ➕     | resident           | account_auth               | DOCUMENT\_\*               |
| wallet           | credited / debited                                 | ➕     | resident           | payments_dues              | WALLET\_\*                 |
| laundry          | ready / picked up / cancelled                      | ➕     | resident           | daily_help                 | LAUNDRY\_\*                |
| canteen          | order ready / collected                            | ➕     | resident           | daily_help                 | CANTEEN\_\*                |
| housekeeping     | scheduled / completed                              | ➕     | resident           | daily_help                 | HOUSEKEEPING\_\*           |
| pest-control     | scheduled / completed                              | ➕     | resident           | daily_help                 | PEST*CONTROL*\*            |
| concierge        | request updated / completed                        | ➕     | resident           | daily_help                 | CONCIERGE\_\*              |
| community        | reply / comment / reaction on own post             | ➕     | post owner         | community                  | COMMUNITY\_\*              |

## Staff

| Area            | Event                             | Status             | Target                            | Category         | data.type               |
| --------------- | --------------------------------- | ------------------ | --------------------------------- | ---------------- | ----------------------- |
| visitor         | resident decision relayed to gate | ✅                 | staff                             | approval_results | VISITOR_DECISION        |
| service-request | scheduled-visit reminder          | ✅                 | staff                             | staff_tasks      | SR_REMINDER             |
| service-request | task assigned                     | ➕                 | assignee                          | staff_tasks      | TASK_ASSIGNED           |
| sos             | SOS raised                        | ➕                 | society SECURITY (push, critical) | emergency_sos    | SOS_TRIGGERED           |
| staff/leave     | leave approved / rejected         | ➕                 | staff                             | account_auth     | LEAVE_APPROVED/REJECTED |
| staff           | dismissed / offboarded            | ➕                 | staff                             | account_auth     | STAFF_DISMISSED         |
| staff           | salary slip published             | ➕ (if write path) | staff                             | payments_dues    | SALARY_SLIP             |
| staff           | document verified / rejected      | ➕ (if write path) | staff                             | account_auth     | STAFF*DOC*\*            |

## Implemented in this change

All ➕ rows above were wired to `push.send` / `push.sendToSociety` (fire-and-forget,
also lands in the in-app inbox), EXCEPT the skips below. Highlights:

- **service-request**: created/assigned/completed (+rate prompt) → resident; assigned → staff push (was socket-only).
- **sos**: now also pushes role `STAFF` (guards) with `critical: true` — was ADMIN-only.
- **maintenance**: bill generated (in `admin.service.generateBills`), payment received, payment failed.
- **package**: parcel arrived/collected now push (were socket-only).
- **notice**: normal notices push (`notices`) alongside the existing emergency path.
- **event/amenity/medical**: create/cancel/confirm/reschedule + waitlist-promoted.
- **wallet/laundry/canteen/housekeeping/concierge**: status changes → resident.
- **community**: comment + like (via `toggleLike`, which carries the actor) → post owner.
- **staff**: leave approved/rejected, dismissal.

## Skipped — no backend write path / no target (revisit later)

- **BILL_OVERDUE** — overdue is computed on read; no job writes an OVERDUE status. Needs a cron.
- **Event / amenity / medical reminders** — no scheduler exists; would need a cron.
- **Salary slip published, staff document verified/rejected** — read-only today; no publish/verify endpoint.
- **pest-control** — society-wide (`PestControlSchedule` has no resident), so no per-resident target.
- **community `reactToPost`** — that overload carries no actor id; only the `toggleLike` path is wired.

## Out of scope

- WhatsApp / SMS / email channels (push + in-app inbox only).
- admin-web receive UI (send-only by design).
