import * as Location from 'expo-location';
import {
  requestLocationPermission,
  getCurrentPosition,
  distanceMeters,
  pointInPolygon,
  distanceToPolygon,
  type LatLng,
} from '../src/lib/geo';

describe('requestLocationPermission', () => {
  it('returns true when status is "granted"', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    expect(await requestLocationPermission()).toBe(true);
  });

  it('returns false when status is "denied"', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    expect(await requestLocationPermission()).toBe(false);
  });

  it('returns false when requestForegroundPermissionsAsync throws', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('HW unavailable'));
    expect(await requestLocationPermission()).toBe(false);
  });
});

describe('getCurrentPosition', () => {
  const mockGetCurrentPositionAsync = Location.getCurrentPositionAsync as jest.Mock;
  const mockRequestPerm = Location.requestForegroundPermissionsAsync as jest.Mock;

  beforeEach(() => {
    mockRequestPerm.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 19.076, longitude: 72.8777, accuracy: 10 },
      mocked: false,
    });
  });

  it('returns { lat, lng } on success', async () => {
    const pos = await getCurrentPosition();
    expect(pos).toEqual({ lat: 19.076, lng: 72.8777 });
  });

  it('returns null when permission is denied', async () => {
    mockRequestPerm.mockResolvedValueOnce({ status: 'denied' });
    expect(await getCurrentPosition()).toBeNull();
  });

  it('returns null when getCurrentPositionAsync throws', async () => {
    mockGetCurrentPositionAsync.mockRejectedValueOnce(new Error('GPS off'));
    expect(await getCurrentPosition()).toBeNull();
  });
});

describe('distanceMeters', () => {
  it('returns 0 for the same point', () => {
    const a: LatLng = { lat: 19.076, lng: 72.877 };
    expect(distanceMeters(a, a)).toBeCloseTo(0, 0);
  });

  it('returns correct approx distance between two known points (Mumbai–Pune ≈ 120km straight-line)', () => {
    const mumbai: LatLng = { lat: 19.076, lng: 72.877 };
    const pune: LatLng = { lat: 18.52, lng: 73.856 };
    const d = distanceMeters(mumbai, pune);
    // Haversine great-circle ~120km
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(130_000);
  });

  it('is symmetric (A→B equals B→A)', () => {
    const a: LatLng = { lat: 28.6, lng: 77.2 };
    const b: LatLng = { lat: 13.08, lng: 80.27 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 0);
  });
});

describe('pointInPolygon', () => {
  // Simple square: (0,0)→(0,1)→(1,1)→(1,0) in lat/lng space
  const square: LatLng[] = [
    { lat: 0, lng: 0 },
    { lat: 1, lng: 0 },
    { lat: 1, lng: 1 },
    { lat: 0, lng: 1 },
  ];

  it('returns true for a point clearly inside the polygon', () => {
    expect(pointInPolygon({ lat: 0.5, lng: 0.5 }, square)).toBe(true);
  });

  it('returns false for a point clearly outside the polygon', () => {
    expect(pointInPolygon({ lat: 2, lng: 2 }, square)).toBe(false);
  });

  it('returns false for an empty polygon', () => {
    expect(pointInPolygon({ lat: 0.5, lng: 0.5 }, [])).toBe(false);
  });

  it('returns false for a polygon with fewer than 3 vertices', () => {
    const line = [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }];
    expect(pointInPolygon({ lat: 0.5, lng: 0.5 }, line)).toBe(false);
  });

  it('returns false for a null polygon (defensive)', () => {
    expect(pointInPolygon({ lat: 0.5, lng: 0.5 }, null as any)).toBe(false);
  });
});

describe('distanceToPolygon', () => {
  // Unit square centroid is at (0.5, 0.5)
  const square: LatLng[] = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 1, lng: 1 },
    { lat: 1, lng: 0 },
  ];

  it('returns correct distance from a point to the polygon centroid', () => {
    const centroid: LatLng = { lat: 0.5, lng: 0.5 };
    const point: LatLng = { lat: 0.5, lng: 0.5 };
    // Same as centroid → distance ≈ 0
    expect(distanceToPolygon(point, square)).toBeCloseTo(0, 0);
  });

  it('returns Infinity for an empty polygon', () => {
    expect(distanceToPolygon({ lat: 1, lng: 1 }, [])).toBe(Infinity);
  });

  it('returns Infinity when polygon is null/undefined (defensive)', () => {
    expect(distanceToPolygon({ lat: 1, lng: 1 }, null as any)).toBe(Infinity);
  });

  it('returns a positive distance for a point far from centroid', () => {
    const far: LatLng = { lat: 10, lng: 10 };
    const d = distanceToPolygon(far, square);
    expect(d).toBeGreaterThan(1_000_000); // >1000 km
  });
});
