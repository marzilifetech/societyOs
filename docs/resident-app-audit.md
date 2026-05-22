# Resident App Audit

Date: 2026-05-01

## Docs Reviewed

- `docs/prioriti.md`
- `docs/SocietyOS_BRD copy.rtf`

## Product Assumption Correction

- Resident app should be optimized for senior citizens.
- The BRD age-group wording that mentions `25-65` should not drive resident UX decisions.
- Current resident app changes were implemented with senior-friendly priorities:
  - larger tap targets
  - simpler onboarding copy
  - cleaner navigation
  - reduced dead-end routes in v1

## TODO Scan

Repository scan found no open `TODO`/`FIXME` markers in the resident app itself.

Remaining non-v1 TODOs elsewhere:

- `backend/src/common/storage/s3.service.ts`
  - AWS/S3 production wiring is still a future infrastructure task.
- `backend/src/modules/canteen/canteen.service.ts`
  - dish ratings are not in schema yet.

## Resident V1 Status

Priority v1 flows from the docs are now implemented and verified for the resident app:

- resident onboarding and approval wait state
- visitor invite, pass details, deny flow
- service request create, list, detail, rating
- complaints create, list, detail, rating
- maintenance bills, payment-order demo flow, payment verification hook
- notices and polls
- notification preferences

## Additional Resident Features Working

- doctor listing, slot lookup, appointment booking, appointment list, SOS entry
- events list, registration, cancellation, waitlist-aware UI
- canteen weekly menu view
- property listing flows (resident create/list/community + express interest): `apps/resident-app/app/property/index.tsx` — APIs on `notice.controller.ts` (`/notices/property/listings*` under `/v1`)
- travel pause flows (resident create/list/return reporting): `apps/resident-app/app/travel/index.tsx` — APIs (`/notices/travel/pauses*` under `/v1`)

## Intentionally shallow / product follow-ups

- BRD “buyer introduction” and automatic **billing adjustment during travel pause** need explicit product + finance sign-off (not covered in this audit).

## Verification Completed

- backend build: passed
- backend test suite: passed
- resident app typecheck: passed
- Expo Android export/bundle: passed

## Notes

- Resident app Expo assets were added so config/build no longer fail on missing files.
- Current app icon/splash assets are functional baseline assets and can be replaced later with final brand artwork.
