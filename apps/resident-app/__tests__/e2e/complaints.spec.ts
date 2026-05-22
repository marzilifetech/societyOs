/**
 * E2E — Resident Complaints (BRD §3.2.6; RS-08)
 *
 * Story: RS-08 Resident raises a complaint about a broken lift;
 *               it gets tracked and resolved systematically.
 *
 * BRD §3.2.6 Complaints Management:
 *  - Raise complaint with category (Water, Electricity, Lift, Parking, Noise, Cleanliness)
 *  - Attach photos and descriptions
 *  - Track status: Raised → Under Review → Assigned → Resolved → Closed
 *  - Notifications at each status change
 *  - Escalate unresolved complaints after a set period
 *  - Rate resolution quality on closure
 *  - View past complaints and resolutions
 *  - Anonymous submission option
 */

describe('RS-08 New Complaint Form (/complaints/new)', () => {
  it.skip('renders category picker: Water / Electricity / Lift / Parking / Noise / Cleanliness / Other', () => {});
  it.skip('title + description fields are required; description >= 10 chars', () => {});
  it.skip('photo attach via expo-image-picker, multiple supported, compressed before upload', () => {});
  it.skip('Anonymous toggle hides resident identity from staff', () => {});
  it.skip('POST /complaints {category, title, description, photos, isAnonymous} returns {id}', () => {});
  it.skip('navigates to /complaints/[id] with PENDING status', () => {});
});

describe('RS-08 Complaint List (/complaints)', () => {
  it.skip('GET /complaints/my returns my complaints sorted recent first', () => {});
  it.skip('status pills: Raised / Under Review / Assigned / Resolved / Closed', () => {});
  it.skip('filter by status tab', () => {});
  it.skip('search by title or category', () => {});
});

describe('Complaint Detail & Status Tracking', () => {
  it.skip('GET /complaints/:id returns full complaint with timeline', () => {});
  it.skip('timeline shows each status transition with timestamp + actor', () => {});
  it.skip('FCM notification updates status on the screen without manual refresh', () => {});
  it.skip('shows assigned staff card when ASSIGNED', () => {});
  it.skip('shows resolution notes when RESOLVED', () => {});
});

describe('RS-08 Rate Resolution', () => {
  it.skip('on RESOLVED, rate widget appears: 1-5 stars + comment', () => {});
  it.skip('POST /complaints/:id/rate {rating, note} closes loop and transitions to CLOSED', () => {});
  it.skip('rating influences staff performance score', () => {});
});

describe('Escalation (BRD §3.2.6)', () => {
  it.skip('shows "Escalate" button if unresolved past SLA threshold', () => {});
  it.skip('POST /complaints/:id/escalate notifies society admin', () => {});
  it.skip('escalation banner appears on row in red', () => {});
});

describe('Anonymous Complaints (BRD §3.2.6)', () => {
  it.skip('Anonymous submission removes resident identity in payload sent to admin', () => {});
  it.skip('anonymous complaints still trackable by the original resident from /complaints', () => {});
});

describe('Photo Attachment', () => {
  it.skip('photo upload uses presigned URL, then POST /complaints/:id/photos {key}', () => {});
  it.skip('image preview thumbnails on detail screen open lightbox', () => {});
});
