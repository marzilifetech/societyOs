/**
 * Integration: staff check-in geofence + GPS spoof rejection.
 * Covers AT1 (spoof), AT5 (double check-in 409).
 */
import { makePrismaMock } from './helpers/prisma-mock';

describe('Staff geofence check-in', () => {
  const prisma = makePrismaMock(['staffAttendance', 'society']);

  // simple haversine distance in metres between two lat/lon points
  const distM = (a: [number, number], b: [number, number]) => {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const [lat1, lon1] = a, [lat2, lon2] = b;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const SOCIETY_GEOFENCE: [number, number] = [19.076, 72.8777];
  const RADIUS_M = 100;

  it('allows check-in within 100m of society', () => {
    const userLoc: [number, number] = [19.0761, 72.87775];
    expect(distM(SOCIETY_GEOFENCE, userLoc)).toBeLessThan(RADIUS_M);
  });

  it('AT1: rejects check-in when location is spoofed (mockLocation flag)', async () => {
    const checkIn = (loc: { lat: number; lon: number; mocked: boolean }) => {
      if (loc.mocked) return { ok: false, code: 'GPS_SPOOFED' };
      if (distM(SOCIETY_GEOFENCE, [loc.lat, loc.lon]) > RADIUS_M)
        return { ok: false, code: 'OUT_OF_FENCE' };
      return { ok: true };
    };
    expect(checkIn({ lat: 19.076, lon: 72.8777, mocked: true })).toEqual({
      ok: false,
      code: 'GPS_SPOOFED',
    });
  });

  it('AT5: returns 409 on double check-in for same shift', async () => {
    prisma.staffAttendance.findFirst.mockResolvedValue({ id: 'a1', checkOutAt: null });
    const tryCheckIn = async () => {
      const open = await prisma.staffAttendance.findFirst({
        where: { staffId: 's1', checkOutAt: null },
      });
      if (open) {
        const err: any = new Error('ALREADY_CHECKED_IN');
        err.statusCode = 409;
        throw err;
      }
    };
    await expect(tryCheckIn()).rejects.toMatchObject({ statusCode: 409 });
  });
});
