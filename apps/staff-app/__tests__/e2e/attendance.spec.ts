/**
 * E2E — Staff Attendance & Geofence (BRD §4.1, §4.5; §6.2 SS-01)
 *
 * Story: SS-01 — Security guard logs attendance via the app on arrival;
 *                 hours are tracked without manual registers.
 *
 * BRD §4.1 Attendance & Shift Management:
 *  - Daily login/logout with location verification (within community geofence)
 *  - Biometric / face-ID based check-in (if hardware available)
 *  - Shift schedule view: today, this week, upcoming
 *  - View total hours per day / week / month
 *  - Overtime tracking with admin approval
 *  - Late arrival / early departure flagging with reason submission
 *  - Attendance summary downloadable
 *
 * BRD §4.5 Photo Upload (geo-tagged + timestamped) covered in tasks.spec.ts.
 *
 * Test runner: @testing-library/react-native + Jest, or Detox if installed.
 * These are skeleton tests — no setup required to read them.
 */

// Common testing-library imports used by RN component tests.
// import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
// import AttendanceScreen from '../../app/(tabs)/attendance';

describe('SS-01 Staff Attendance — Geofence Check-In', () => {
  it.skip('renders Check-In button when no attendance record exists for today', () => {});
  it.skip('disables Check-In and shows distance chip when GPS is outside society geofence', () => {});
  it.skip('enables Check-In with green status when GPS is inside society polygon', () => {});
  it.skip('falls back to permissive mode when /staff/society returns no geofence (society not configured)', () => {});
  it.skip('triggers expo-local-authentication biometric prompt before submitting check-in (when supported)', () => {});
  it.skip('POSTs /staff/check-in with {lat, lng, photoUrl?} and shows success toast', () => {});
  it.skip('writes a queued check-in to offline-queue when network is unavailable, syncs on reconnect', () => {});
  it.skip('shows "You are late" alert with deep-link to /attendance/late-reason when API responds isLate:true', () => {});
  it.skip('blocks check-in when GPS permission is denied with a CTA to open settings', () => {});
  it.skip('shows checked-in card with elapsed timer once today record exists', () => {});
});

describe('SS-01 Late Reason Submission (BRD §4.1 late-arrival flagging)', () => {
  it.skip('renders text input + voice-note recorder on /attendance/late-reason', () => {});
  it.skip('uploads voice note via presigned URL (GET /staff/uploads/presign?type=voice) before POST', () => {});
  it.skip('POSTs /staff/check-in/late-reason with {reason, voiceUrl?} and navigates back', () => {});
  it.skip('disables submit until reason length >= 5 chars', () => {});
});

describe('SS-01 Check-Out Flow', () => {
  it.skip('shows Check-Out button when checked in and not yet checked out', () => {});
  it.skip('POSTs /staff/check-out and reveals total hours worked for today', () => {});
  it.skip('flags early departure with reason prompt if departure < shiftEndAt', () => {});
});

describe('Attendance History & Hours (BRD §4.1)', () => {
  it.skip('renders MonthGrid with status colours: present (green), absent (gray), late (amber), leave (blue)', () => {});
  it.skip('opens DayDetailSheet on tap of a day cell', () => {});
  it.skip('paginates between months and refetches /staff/attendance?month=&year=', () => {});
  it.skip('shows totals: hours per day / week / month aggregated from history response', () => {});
  it.skip('exports attendance summary (CSV / PDF download) via download icon — pending backend', () => {});
});

describe('Shift Schedule (BRD §4.1)', () => {
  it.skip('renders today / this week / upcoming tabs on /attendance/shifts', () => {});
  it.skip('GETs /staff/shifts?range=today and renders shift card with start/end + role', () => {});
  it.skip('shows empty state when no shifts assigned for range', () => {});
});
