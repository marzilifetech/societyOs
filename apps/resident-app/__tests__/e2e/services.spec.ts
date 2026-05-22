/**
 * E2E — Resident Service Requests (BRD §3.2.1; RS-02, RS-03)
 *
 * Stories:
 *  - RS-02 Resident requests a plumber with a preferred time slot;
 *           tap fixed without calling admin.
 *  - RS-03 Resident rates the plumber after the job is done;
 *           others can choose providers based on reviews.
 *
 * BRD §3.2.1 Utility Service Request Management:
 *  - Browse services: Plumber / Electrician / Carpenter / Painter / Pest / Appliance Repair
 *  - View provider profiles: name, photo, specialisation, avg rating
 *  - Book with preferred date and time slot
 *  - Real-time status: Requested → Assigned → In Progress → Completed
 *  - Push notifications at each stage
 *  - Rate (1-5) + text review on completion
 *  - View past history; one-tap repeat request
 *  - Admin-managed catalog (which services are available)
 */

describe('RS-02 Service Catalog (Services tab)', () => {
  it.skip('renders /(tabs)/services with category cards (Plumbing, Electrical, etc.) from admin catalog', () => {});
  it.skip('GET /service-requests/catalog returns enabled categories for this society', () => {});
  it.skip('hides categories that admin has disabled', () => {});
  it.skip('search bar filters by category name', () => {});
});

describe('RS-02 Provider Profiles (BRD §3.2.1)', () => {
  it.skip('tapping a category lists provider profiles with photo, specialisation, avg rating', () => {});
  it.skip('star rating displays one decimal place; total review count visible', () => {});
  it.skip('profile detail opens recent reviews with timestamps', () => {});
});

describe('RS-02 Book Service Request', () => {
  it.skip('"+ Request Service" navigates to /services/new with category preselected', () => {});
  it.skip('form fields: category, description, preferred date, preferred slot', () => {});
  it.skip('photo attachment via expo-image-picker, multiple supported', () => {});
  it.skip('POST /service-requests with {category, description, photos, slot} returns {id}', () => {});
  it.skip('navigates to /services/[id] showing PENDING status', () => {});
});

describe('RS-02 Real-Time Status Tracking', () => {
  it.skip('GET /service-requests/:id returns current status + assignee', () => {});
  it.skip('status pill animates as: PENDING → ASSIGNED → IN_PROGRESS → COMPLETED', () => {});
  it.skip('FCM push at each transition updates the status without manual refresh', () => {});
  it.skip('shows assigned staff name + photo + ETA after assignment', () => {});
  it.skip('shows before/after photos uploaded by staff once IN_PROGRESS', () => {});
});

describe('RS-02 My Requests List', () => {
  it.skip('Services tab shows active + past requests via GET /service-requests/my', () => {});
  it.skip('groups by status; sorts active first', () => {});
  it.skip('long-press opens "Repeat" action that prefills /services/new from history', () => {});
});

describe('RS-03 Rate Service After Completion', () => {
  it.skip('on COMPLETED, /services/[id] shows star rating widget (1-5) + textarea', () => {});
  it.skip('disables rate button until rating chosen', () => {});
  it.skip('POST /service-requests/:id/rate with {rating, note} closes the loop', () => {});
  it.skip('confirmation modal explains rating influences provider visibility', () => {});
  it.skip('after submit, the rating becomes visible on provider profile', () => {});
});
