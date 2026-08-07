import { useCallback, useRef } from 'react';
import {
  Platform,
  UIManager,
  requireNativeComponent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { CameraView } from 'expo-camera';

const VIEW_NAME = 'MarziQrScannerView';

/**
 * True when the Kotlin CameraX scanner (plugins/withNativeQrScanner.js) is
 * linked into this binary.
 *
 * `getViewManagerConfig` returns null rather than throwing for an unknown view,
 * which makes it the safe way to feature-detect: rendering an unregistered
 * native component instead raises "Unimplemented component", a red screen in
 * dev and a blank area in release.
 */
export const nativeScannerAvailable =
  Platform.OS === 'android' && UIManager.getViewManagerConfig?.(VIEW_NAME) != null;

type NativeProps = {
  style?: ViewStyle;
  torch?: boolean;
  paused?: boolean;
  onCodeScanned?: (e: NativeSyntheticEvent<{ data: string }>) => void;
};

const NativeQrScannerView = nativeScannerAvailable
  ? requireNativeComponent<NativeProps>(VIEW_NAME)
  : null;

export type QrScannerProps = {
  style?: ViewStyle;
  /** Torch/flashlight. Ignored by the fallback path on devices without one. */
  torch?: boolean;
  /** Stop emitting results (e.g. while a lookup is in flight). */
  paused?: boolean;
  onScan: (value: string) => void;
};

/**
 * QR scanner with a native fast path and an expo-camera fallback.
 *
 * NATIVE PATH (Android release builds): CameraX + MLKit running entirely in
 * Kotlin. Detection, same-code de-duplication and torch live on the native
 * side, so `onScan` fires exactly ONCE per physical scan.
 *
 * FALLBACK PATH (iOS, Expo Go, or JS reloaded against an older binary):
 * expo-camera's `onBarcodeScanned`. That callback fires for EVERY frame
 * containing a code — roughly 25 times a second for a stationary QR — so this
 * component applies the same de-dupe in JS. Without it, a single scan would
 * fire a burst of duplicate lookups.
 *
 * Both paths therefore present the identical contract to callers: one call per
 * scan, no duplicate-suppression logic needed at the call site.
 */
const DEDUPE_MS = 2500;

export function QrScanner({ style, torch, paused, onScan }: QrScannerProps) {
  const last = useRef<{ value: string; at: number } | null>(null);

  const handle = useCallback(
    (value: string) => {
      if (!value) return;
      const now = Date.now();
      const prev = last.current;
      if (prev && prev.value === value && now - prev.at < DEDUPE_MS) return;
      last.current = { value, at: now };
      onScan(value);
    },
    [onScan],
  );

  if (NativeQrScannerView) {
    return (
      <NativeQrScannerView
        style={style}
        torch={!!torch}
        paused={!!paused}
        // The native side already de-dupes; `handle` is kept in the path so the
        // two implementations cannot drift apart in behaviour.
        onCodeScanned={(e) => handle(e.nativeEvent.data)}
      />
    );
  }

  return (
    <CameraView
      style={style}
      facing="back"
      enableTorch={!!torch}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={paused ? undefined : ({ data }) => handle(data)}
    />
  );
}
