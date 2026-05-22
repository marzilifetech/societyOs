/**
 * E2E — Resident Events (BRD §3.2.3; RS-05)
 *
 * Story: RS-05 Resident registers for the community yoga session;
 *               can confirm spot and get a reminder.
 *
 * BRD §3.2.3 Event Management:
 *  - Browse upcoming events (admin-organised)
 *  - View details: name, date, time, venue, description, organiser
 *  - Register / RSVP with one tap
 *  - View number of registered attendees
 *  - See list of neighbours attending the same event
 *  - Receive reminders 24h and 1h before event
 *  - Post-event feedback and rating
 *  - Admin creates and manages events; resident-led events subject to approval
 */

describe('RS-05 Upcoming Events List', () => {
  it.skip('renders /events with upcoming events sorted by date asc', () => {});
  it.skip('GET /events returns admin-published events for this society', () => {});
  it.skip('shows registered count vs capacity per event', () => {});
  it.skip('shows "FULL" pill when capacity reached, with Join Waitlist CTA', () => {});
  it.skip('past events appear in a separate Past tab', () => {});
});

describe('RS-05 Event Detail & Register', () => {
  it.skip('event card tap opens detail with description, organiser, venue', () => {});
  it.skip('Register button POSTs /events/:id/register; UI updates to "Registered"', () => {});
  it.skip('disabled if cap reached and not on waitlist', () => {});
  it.skip('Cancel registration via DELETE /events/:id/register or PATCH /:id/cancel-registration', () => {});
  it.skip('shows "X neighbours attending" with avatar pile', () => {});
});

describe('RS-05 Reminders (BRD §3.2.3)', () => {
  it.skip('local notification scheduled at event_time - 24h on registration', () => {});
  it.skip('local notification scheduled at event_time - 1h on registration', () => {});
  it.skip('cancelling registration cancels both scheduled notifications', () => {});
});

describe('Post-Event Feedback', () => {
  it.skip('after event end_at, registered residents see Feedback prompt', () => {});
  it.skip('star rating + comment POSTs /events/:id/feedback', () => {});
  it.skip('thank-you screen shows after submit', () => {});
});

describe('Resident-Led Events', () => {
  it.skip('"Propose Event" button POSTs /events/proposals to admin queue', () => {});
  it.skip('proposed events show "Pending Approval" badge until admin approves', () => {});
});
