/**
 * E2E — Resident Property Sale (BRD §3.2.9; RS-11)
 *
 * Story: RS-11 Resident lists their apartment for sale;
 *               interested buyers within the community are notified.
 *
 * BRD §3.2.9 Property Sale Request:
 *  - Submit listing: flat number, area, asking price, contact details
 *  - Admin approves/rejects before going live on community board
 *  - Interested buyers (other residents) can express interest
 *  - Admin facilitates introduction between seller and buyer
 *  - Status tracking: Under Review → Approved → Listed → Under Negotiation → Sold
 *  - Option to remove listing at any time
 *
 * IMPLEMENTATION NOTE (QA): Resident property UI exists (`app/property`). These specs are
 * skipped until Detox/E2E harness runs against a live API; scenarios remain the acceptance checklist.
 */

describe('RS-11 New Listing Submission (NOT IMPLEMENTED)', () => {
  it.skip('renders /property/new with form: title, area (sqft), askingPrice, description, contact phone', () => {});
  it.skip('photo upload via expo-image-picker, multiple via presigned upload', () => {});
  it.skip('flat number is auto-prefilled from resident profile (read-only)', () => {});
  it.skip('asking price formatted as INR currency on input blur', () => {});
  it.skip('POST /property/listings returns {id, status: UNDER_REVIEW}', () => {});
});

describe('RS-11 My Listings (/property)', () => {
  it.skip('GET /property/listings/my returns the resident\'s listings', () => {});
  it.skip('status pill: Under Review / Approved / Listed / Under Negotiation / Sold / Rejected', () => {});
  it.skip('Remove Listing button DELETEs /property/listings/:id with confirm', () => {});
});

describe('Community Property Board (BRD §3.2.9)', () => {
  it.skip('Browse tab GETs /property/listings (society-wide approved listings)', () => {});
  it.skip('cards show: flat, area, price, primary photo', () => {});
  it.skip('hides own listings from browse view', () => {});
});

describe('RS-11 Express Interest', () => {
  it.skip('listing detail has "I\'m Interested" button POST /property/listings/:id/interest', () => {});
  it.skip('seller receives FCM notification "Buyer interested"', () => {});
  it.skip('buyer receives "Admin will facilitate introduction" message', () => {});
});

describe('Admin Facilitation (BRD §3.2.9)', () => {
  it.skip('admin sees interest list per listing on /admin/property page', () => {});
  it.skip('admin "Connect" button shares contact details with both parties (consent-based)', () => {});
});

describe('Status Transitions', () => {
  it.skip('Under Review → Approved happens after admin approval (FCM)', () => {});
  it.skip('Listed → Under Negotiation when first buyer interest registered', () => {});
  it.skip('seller can mark Sold via PATCH /property/listings/:id/sold', () => {});
  it.skip('Sold listings auto-archive from public board after 30 days', () => {});
});

describe('Notifications (BRD §3.2.9)', () => {
  it.skip('approval / rejection FCM updates resident\'s listing status badge', () => {});
  it.skip('community-wide FCM "new listing" sent on Approved (opt-in)', () => {});
});
