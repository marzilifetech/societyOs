import { ensurePermission, type PermissionResult } from './permissions';

export type CameraPermissionStatus = 'granted' | 'denied';

/**
 * @deprecated Use `ensurePermission('camera')` directly — it distinguishes a
 * refusal we can re-ask from one only OS settings can undo, and offers the
 * user a way through instead of a dead end. Kept as a thin wrapper so existing
 * callers keep compiling.
 */
export async function requestCameraPermissions(): Promise<CameraPermissionStatus> {
  const { granted } = await ensurePermission('camera');
  return granted ? 'granted' : 'denied';
}

/** Full result, for callers that want to react to `blocked` specifically. */
export function ensureCamera(): Promise<PermissionResult> {
  return ensurePermission('camera');
}
