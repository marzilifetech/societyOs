/**
 * E2E — Staff Reviews & Ratings (BRD §4.3; §6.2 SS-05)
 *
 * Story: SS-05 Any staff views performance ratings from residents;
 *               can improve service quality.
 *
 * BRD §4.3 Reviews & Ratings:
 *  - View ratings + reviews received from residents for completed tasks
 *  - Overall performance score + trend over time
 *  - Flag inappropriate reviews to admin
 *  - Notification when a new review is posted
 *  - Admin-visible performance leaderboard (configurable)
 */

describe('SS-05 Reviews List (/reviews)', () => {
  it.skip('GETs /staff/reviews and renders one card per review with stars + text + resident initial', () => {});
  it.skip('shows review timestamp ("2 days ago") via date-fns formatRelative', () => {});
  it.skip('orders newest first; supports filter by rating (1..5 stars)', () => {});
  it.skip('opens flag modal with reason picker; POST /staff/reviews/:id/flag {reason}', () => {});
  it.skip('shows empty state with cheerful illustration when no reviews', () => {});
  it.skip('shows skeleton loader while fetching', () => {});
});

describe('Performance Score & Trend (/reviews/performance)', () => {
  it.skip('GETs /staff/performance and renders donut chart with avg rating + total reviews', () => {});
  it.skip('renders 6-month trend line chart (avg rating per month)', () => {});
  it.skip('shows breakdown by category (plumbing tasks: 4.5★, cleaning: 4.8★…)', () => {});
  it.skip('shows leaderboard rank when admin has enabled leaderboard for this society', () => {});
});

describe('Review Notifications (BRD §4.3)', () => {
  it.skip('subscribes to FCM topic staff/:id/reviews and shows in-app banner on new review', () => {});
  it.skip('updates review list cache on push event without manual refresh', () => {});
});
