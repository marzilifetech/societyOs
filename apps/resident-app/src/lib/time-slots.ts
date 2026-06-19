/** Returns true when `dateIso` (YYYY-MM-DD) is today in local time. */
export function isToday(dateIso: string): boolean {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateIso === todayIso;
}

/** Filter HH:mm slots that have already passed today. */
export function filterPastTimeSlots(slots: string[], dateIso: string): string[] {
  if (!isToday(dateIso)) return slots;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => {
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m > nowMinutes;
  });
}

/** Filter 12-hour slots like "09:00 AM" for a given Date. */
export function filterPastAmPmSlots(slots: string[], date: Date): string[] {
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (!sameDay) return slots;

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  return slots.filter((slot) => {
    const match = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return true;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes > nowMinutes;
  });
}
