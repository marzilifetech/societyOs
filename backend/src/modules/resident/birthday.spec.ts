import { birthdayWithoutYear } from './resident.service';

describe('birthdayWithoutYear', () => {
  it('drops the year and keeps the day for a UTC-midnight date', () => {
    expect(birthdayWithoutYear(new Date('1990-05-10T00:00:00.000Z'))).toBe('2000-05-10T12:00:00.000Z');
  });

  it('keeps the day for an IST midnight stored as 18:30 UTC the day before', () => {
    expect(birthdayWithoutYear(new Date('1990-05-09T18:30:00.000Z'))).toBe('2000-05-10T12:00:00.000Z');
  });

  it('handles 29 February', () => {
    expect(birthdayWithoutYear(new Date('1992-02-29T00:00:00.000Z'))).toBe('2000-02-29T12:00:00.000Z');
  });
});
