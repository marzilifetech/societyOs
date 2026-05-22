/**
 * E2E — Resident Medical Appointments (BRD §3.2.5; RS-07)
 *
 * Story: RS-07 Resident books an appointment with the society doctor;
 *               can get a check-up without going to a hospital.
 *
 * BRD §3.2.5 Medical Help Desk Appointments:
 *  - Book with on-site medical staff or visiting doctors
 *  - View available doctors / nurses + visiting schedule
 *  - Preferred date and time slot
 *  - View upcoming + past appointments
 *  - Confirmation + reminders
 *  - Cancel or reschedule with advance notice
 *  - Telehealth / video consultation (if enabled)
 */

describe('RS-07 Doctor List', () => {
  it.skip('renders /medical/index with available doctors via GET /medical/doctors', () => {});
  it.skip('shows doctor card: name, specialisation, photo, next available slot', () => {});
  it.skip('renders "On-site today" badge for doctors at the help desk now', () => {});
  it.skip('search by specialisation filters list', () => {});
});

describe('RS-07 Slot Picker & Booking', () => {
  it.skip('selecting a doctor opens slot picker for the next 14 days', () => {});
  it.skip('GET /medical/slots?doctorId=&date= returns available time slots', () => {});
  it.skip('greys out booked slots; only available are tappable', () => {});
  it.skip('POST /medical/appointments {doctorId, slot, notes} returns {id}', () => {});
  it.skip('navigates to confirmation screen with cancel + add-to-calendar option', () => {});
});

describe('My Appointments (/medical/appointments)', () => {
  it.skip('GET /medical/appointments/mine returns upcoming + past', () => {});
  it.skip('upcoming card shows doctor, slot, status (CONFIRMED / CANCELLED)', () => {});
  it.skip('Cancel button PATCH /medical/appointments/:id/cancel with confirm', () => {});
  it.skip('Reschedule button reopens slot picker for same doctor', () => {});
  it.skip('past appointments include prescription / notes from doctor (if uploaded)', () => {});
});

describe('Reminders (BRD §3.2.5)', () => {
  it.skip('local notification scheduled at appointment_time - 24h', () => {});
  it.skip('local notification scheduled at appointment_time - 1h', () => {});
});

describe('Telehealth (when enabled by admin)', () => {
  it.skip('Video Call button appears 5 min before slot when telehealth=true', () => {});
  it.skip('button launches Twilio/Agora session with one-tap join', () => {});
  it.skip('hidden when society config telehealth=false', () => {});
});
