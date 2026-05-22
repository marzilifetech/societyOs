/**
 * E2E — Staff Tasks / Service Requests (BRD §4.2, §4.5; §6.2 SS-02, SS-03)
 *
 * Stories:
 *  - SS-02 Plumber sees assigned service requests for today (which flats, in what order)
 *  - SS-03 Plumber uploads before / after photos as proof of repair
 *
 * BRD §4.2 Task Management:
 *  - List of SRs assigned by admin (plumbing, carpentry, cleaning…)
 *  - Detail: resident name, flat, description, resident-attached photos
 *  - Status: Accepted → In Progress → Completed
 *  - Reject task with reason → escalates to admin
 *  - Add notes / comments to a task
 *  - Real-time push notification on new assignment
 *  - Full history of completed tasks
 *
 * BRD §4.5 Photo Upload (Proof of Work):
 *  - Multiple photos per task (before / during / after)
 *  - Auto-tagged with GPS + timestamp
 *  - Compressed upload
 *  - Optional voice note alongside photos
 */

describe('SS-02 Tasks Tab — Assigned Service Requests', () => {
  it.skip('renders /(tabs)/tasks with sections: Today, Upcoming, Completed', () => {});
  it.skip('GETs /service-requests/assigned and groups by date', () => {});
  it.skip('shows resident name + flat + category badge per task card', () => {});
  it.skip('shows priority chip (High / Med / Low) and SLA countdown', () => {});
  it.skip('orders tasks by SLA ascending (most urgent first)', () => {});
  it.skip('pull-to-refresh re-runs /service-requests/assigned', () => {});
  it.skip('handles offline mode: reads cached tasks from react-query persister', () => {});
  it.skip('subscribes to FCM topic per staff user; shows in-app banner on new assignment', () => {});
});

describe('Task Detail (/tasks/[id])', () => {
  it.skip('GETs /service-requests/:id and renders full description + resident-attached photos', () => {});
  it.skip('shows Accept button (PATCH /service-requests/:id/status {status: ACCEPTED}) when status is ASSIGNED', () => {});
  it.skip('shows In Progress button when status is ACCEPTED', () => {});
  it.skip('shows Complete button (requires before+after photos) when status is IN_PROGRESS', () => {});
  it.skip('opens /tasks/photo-capture on Add Photo tap, passing taskId + phase param', () => {});
  it.skip('lets staff add a text note via POST /service-requests/:id/notes', () => {});
  it.skip('lets staff record a voice note (uploaded via presign) and attach via POST /service-requests/:id/notes {voiceUrl}', () => {});
  it.skip('shows Reject button with reason modal; PATCH status:REJECTED, reason — escalates to admin', () => {});
  it.skip('shows translation toggle (POST /translate) for Hindi <-> English description', () => {});
});

describe('SS-03 Photo Capture — Before/After Proof of Work', () => {
  it.skip('opens expo-camera with phase selector (Before / During / After)', () => {});
  it.skip('compresses captured image via expo-image-manipulator (resize+quality reduction)', () => {});
  it.skip('embeds GPS lat/lng + ISO timestamp into upload metadata', () => {});
  it.skip('GETs /service-requests/:id/photos/presign and PUTs blob to S3-compatible URL', () => {});
  it.skip('POSTs /service-requests/:id/photos {key, phase, lat, lng, capturedAt} after upload', () => {});
  it.skip('shows progress indicator and retries on transient failure', () => {});
  it.skip('queues upload offline when network is down; syncs on reconnect via offline-queue', () => {});
  it.skip('rejects photos older than 5 minutes (anti-fraud — must be live)', () => {});
});

describe('SS-02 Task History', () => {
  it.skip('renders Completed section with rating + review excerpt per past task', () => {});
  it.skip('opens /tasks/[id] in read-only mode for completed tasks', () => {});
});
