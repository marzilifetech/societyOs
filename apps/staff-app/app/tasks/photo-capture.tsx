import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import ViewShot from 'react-native-view-shot';
import NetInfo from '@react-native-community/netinfo';
import { compressImage } from '../../src/lib/upload';
import { getCurrentPosition, type LatLng } from '../../src/lib/geo';
import { requestCameraPermissions } from '../../src/lib/cameraUtils';
import { PermissionFallback } from '../../src/components/common/PermissionFallback';
import { PhaseChips } from '../../src/components/common/PhaseChips';
import { usePhotoCapture } from '../../src/hooks/usePhotoCapture';
import type { PendingPhoto } from '../../src/lib/offline-photo-queue';

type Phase = 'BEFORE' | 'DURING' | 'AFTER';
const PHASES: { id: Phase; label: Phase }[] = [
  { id: 'BEFORE', label: 'BEFORE' },
  { id: 'DURING', label: 'DURING' },
  { id: 'AFTER', label: 'AFTER' },
];

export default function PhotoCaptureScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const viewShotRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('BEFORE');
  const [position, setPosition] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<{ x: number; y: number }[]>([]);

  const { cameraRef, batch, capture: addToBatch, submit, drain, isSubmitting } = usePhotoCapture(String(taskId));

  useEffect(() => {
    requestCameraPermissions().then((status) => {
      setHasPermission(status === 'granted');
    });
    getCurrentPosition().then(setPosition);
  }, []);

  // Drain offline queue when online (Task 44).
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      if (s?.isConnected) drain();
    });
    return () => unsub?.();
  }, [drain]);

  if (hasPermission === null) {
    return <PermissionFallback permission="Camera" loading />;
  }

  if (!hasPermission) {
    return (
      <>
        <Stack.Screen options={{ title: 'Capture' }} />
        <PermissionFallback
          permission="Camera"
          onRetry={() =>
            requestCameraPermissions().then((status) => setHasPermission(status === 'granted'))
          }
        />
      </>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    try {
      setBusy(true);
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: true });
      // We rely on ViewShot wrapping the preview to bake overlay; here just set preview.
      setPreviewUri(pic.uri);
    } catch (e: any) {
      Alert.alert('Capture failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmPreview = async () => {
    if (!previewUri) return;
    setBusy(true);
    try {
      // Bake overlay via ViewShot.
      let baked = previewUri;
      if (viewShotRef.current?.capture) {
        try {
          baked = await viewShotRef.current.capture();
        } catch {
          baked = previewUri;
        }
      }
      const compressed = await compressImage(baked, { maxWidth: 1200, quality: 0.8 });
      const item: PendingPhoto = {
        uri: compressed,
        phase,
        takenAt: new Date().toISOString(),
        lat: position?.lat,
        lng: position?.lng,
      };
      addToBatch(item);
      setPreviewUri(null);
      setAnnotations([]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadAll = async () => {
    const result = await submit();
    if (!result) return;
    const { successCount, failedCount } = result;
    if (failedCount === 0) {
      Alert.alert('Uploaded', `${successCount} photo(s) uploaded.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert(
        'Partial upload',
        `${successCount} uploaded, ${failedCount} queued offline (will retry).`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  };

  const overlayStamp = `${new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })} · ${position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'GPS unavailable'}`;

  // Preview-and-confirm screen
  if (previewUri) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <Stack.Screen options={{ title: 'Confirm Photo' }} />
        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ flex: 1 }}>
          <View className="flex-1 relative">
            <Image source={{ uri: previewUri }} style={{ flex: 1 }} resizeMode="contain" />
            {/* Annotation taps (Task 42) */}
            <TouchableOpacity
              className="absolute inset-0"
              activeOpacity={1}
              onPress={(e) => {
                const { locationX, locationY } = e.nativeEvent;
                setAnnotations((a: { x: number; y: number }[]) => [...a, { x: locationX, y: locationY }]);
              }}
            >
              {annotations.map((a: { x: number; y: number }, i: number) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: a.x - 12,
                    top: a.y - 12,
                    width: 24,
                    height: 24,
                    borderWidth: 3,
                    borderColor: '#ef4444',
                    borderRadius: 12,
                  }}
                />
              ))}
            </TouchableOpacity>
            <View className="absolute bottom-4 left-4 bg-black/60 rounded-lg px-3 py-1.5">
              <Text className="text-white text-xs font-semibold">{phase}</Text>
              <Text className="text-white text-[10px]">{overlayStamp}</Text>
            </View>
          </View>
        </ViewShot>
        <View className="px-6 py-4 bg-black flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-gray-700 rounded-2xl py-3 items-center"
            onPress={() => {
              setPreviewUri(null);
              setAnnotations([]);
            }}
            disabled={busy}
          >
            <Text className="text-white font-semibold">Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-green-500 rounded-2xl py-3 items-center"
            onPress={confirmPreview}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Add to Batch</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ title: 'Capture Photo' }} />
      <CameraView ref={cameraRef as any} style={{ flex: 1 }} facing="back">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-6 pt-4">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-white text-base">← Back</Text>
            </TouchableOpacity>
            <Text className="text-white font-semibold">Capture {phase}</Text>
            <Text className="text-white text-sm">{batch.length}/5</Text>
          </View>

          {/* Phase chips */}
          <View className="px-6 mt-4">
            <PhaseChips phases={PHASES} value={phase} onChange={(id) => setPhase(id as Phase)} />
          </View>

          <View className="flex-1" />

          {/* Live overlay */}
          <View className="px-6 mb-3">
            <View className="bg-black/60 rounded-lg px-3 py-1.5 self-start">
              <Text className="text-white text-[10px]">{overlayStamp}</Text>
            </View>
          </View>

          {/* Batch strip */}
          {batch.length > 0 && (
            <ScrollView horizontal className="max-h-20 mb-3 px-6" showsHorizontalScrollIndicator={false}>
              {batch.map((b: PendingPhoto, i: number) => (
                <Image
                  key={i}
                  source={{ uri: b.uri }}
                  style={{ width: 60, height: 60, borderRadius: 8, marginRight: 8 }}
                />
              ))}
            </ScrollView>
          )}

          {/* Capture row */}
          <View className="flex-row items-center justify-around pb-8 px-6">
            <View style={{ width: 60 }} />
            <TouchableOpacity
              onPress={capture}
              disabled={busy || batch.length >= 5}
              className="w-20 h-20 rounded-full border-4 border-white items-center justify-center"
            >
              <View className="w-14 h-14 rounded-full bg-white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={uploadAll}
              disabled={batch.length === 0 || busy || isSubmitting}
              className={`rounded-full px-4 py-2 ${batch.length === 0 ? 'bg-gray-600' : 'bg-green-500'}`}
              style={{ minWidth: 60 }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-xs font-semibold">Upload ({batch.length})</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}
