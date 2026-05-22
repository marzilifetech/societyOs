import { Camera } from 'expo-camera';

export type CameraPermissionStatus = 'granted' | 'denied';

export async function requestCameraPermissions(): Promise<CameraPermissionStatus> {
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}
