// Geofence + GPS helpers used by attendance/photo flows.
export type LatLng = { lat: number; lng: number };

import * as Location from 'expo-location';
import { checkPermission, ensurePermission } from './permissions';

/**
 * @deprecated Prefer `ensurePermission('location')` from lib/permissions — it
 * distinguishes a refusal we can re-ask from one only OS settings can undo.
 * Kept as a thin wrapper so existing callers keep compiling.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { granted } = await ensurePermission('location');
  return granted;
}

/** Why a position could not be produced. Callers must handle these. */
export type PositionFailure = 'permission' | 'blocked' | 'unavailable' | 'timeout' | 'error';

export type PositionResult =
  | { ok: true; position: LatLng }
  | { ok: false; reason: PositionFailure };

/**
 * Get a fix, reporting WHY when it fails.
 *
 * The previous version requested permission on every call and returned a bare
 * `null`, so a caller could not tell "the user declined" from "we are indoors
 * and the GPS timed out". Check-in used that null to proceed with no location
 * at all — the staff member appeared to check in, and the geofence check that
 * was supposed to run simply did not.
 *
 * @param opts.prompt When false, never shows a dialog — for background//passive
 *   callers that must not interrupt. Defaults to true.
 */
export async function getPosition(
  opts: { prompt?: boolean; timeoutMs?: number } = {},
): Promise<PositionResult> {
  const { prompt = true, timeoutMs = 10_000 } = opts;

  const perm = prompt
    ? await ensurePermission('location')
    : await checkPermission('location');
  if (!perm.granted) {
    return {
      ok: false,
      reason:
        perm.outcome === 'blocked'
          ? 'blocked'
          : perm.outcome === 'unavailable'
            ? 'unavailable'
            : 'permission',
    };
  }

  try {
    // getCurrentPositionAsync can hang indefinitely indoors; a check-in that
    // never resolves is worse than one that reports it could not get a fix.
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!pos) return { ok: false, reason: 'timeout' };
    return { ok: true, position: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch (e) {
    console.warn('[geo] getPosition failed', e);
    return { ok: false, reason: 'error' };
  }
}

/**
 * @deprecated Use `getPosition()`, which explains its failures. This shape
 * cannot distinguish a refusal from a GPS timeout.
 */
export async function getCurrentPosition(): Promise<LatLng | null> {
  const r = await getPosition();
  return r.ok ? r.position : null;
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
