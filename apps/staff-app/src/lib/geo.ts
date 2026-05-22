// Geofence + GPS helpers used by attendance/photo flows.
export type LatLng = { lat: number; lng: number };

import * as Location from 'expo-location';

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getCurrentPosition(): Promise<LatLng | null> {
  try {
    const ok = await requestLocationPermission();
    if (!ok) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e) {
    console.warn('[geo] getCurrentPosition failed', e);
    return null;
  }
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance to polygon centroid as a simple "distance to society" approximation.
export function distanceToPolygon(point: LatLng, polygon: LatLng[]): number {
  if (!polygon?.length) return Infinity;
  const cx = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  const cy = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  return distanceMeters(point, { lat: cy, lng: cx });
}
