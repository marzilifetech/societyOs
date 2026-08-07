import { useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
  type PinchGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';

/**
 * Full-screen photo viewer with pinch-to-zoom.
 *
 * DELIBERATELY uses React Native's built-in `Animated`, not Reanimated.
 *
 * This screen previously used `react-native-reanimated` (useSharedValue /
 * useAnimatedStyle / Gesture.Pinch). On this app's pinned stack — old
 * architecture, Reanimated 3.x, NativeWind 4.1.x — a Reanimated `Animated.*`
 * component inside the NativeWind JSX interop fails to resolve its host
 * instance and throws:
 *
 *     [Reanimated] Cannot find host instance for this component
 *
 * which the root ErrorBoundary catches, replacing the whole screen with
 * "Something went wrong". The identical failure took down the resident app's
 * Emergency SOS screen and was fixed the same way.
 *
 * The legacy `PinchGestureHandler` + `Animated.event({ useNativeDriver: true })`
 * pairing keeps the pinch on the native thread, so there is no smoothness cost
 * for dropping Reanimated here.
 */
type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

const MIN_SCALE = 0.5;

export function PhotoViewer({ visible, uri, onClose }: Props) {
  const { width, height } = Dimensions.get('window');

  // Raw gesture scale, multiplied by whatever zoom was committed by the
  // previous pinch. `baseScale` is a plain Animated.Value rather than state so
  // committing a zoom never triggers a React re-render mid-gesture.
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = useRef(Animated.multiply(baseScale, pinchScale)).current;
  // Animated.Value has no public getter, so the committed zoom is mirrored here.
  const committed = useRef(1);

  const onPinchEvent = useRef(
    Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true }),
  ).current;

  const reset = () => {
    committed.current = 1;
    baseScale.setValue(1);
    pinchScale.setValue(1);
  };

  const onPinchStateChange = (e: PinchGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState !== State.ACTIVE) return;
    const next = committed.current * e.nativeEvent.scale;
    // Fold the finished gesture into the base so the next pinch starts from
    // where this one ended, then snap the gesture value back to identity.
    pinchScale.setValue(1);
    if (next < 1) {
      // Zoomed out past natural size — spring back to fit.
      committed.current = 1;
      Animated.timing(baseScale, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }
    committed.current = Math.max(MIN_SCALE, next);
    baseScale.setValue(committed.current);
  };

  const resetAndClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={resetAndClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black">
          <TouchableOpacity
            className="flex-1 items-center justify-center"
            onPress={resetAndClose}
            activeOpacity={1}
          >
            {uri ? (
              <PinchGestureHandler
                onGestureEvent={onPinchEvent}
                onHandlerStateChange={onPinchStateChange}
              >
                <Animated.Image
                  source={{ uri }}
                  style={[{ width, height: height * 0.85 }, { transform: [{ scale }] }]}
                  resizeMode="contain"
                />
              </PinchGestureHandler>
            ) : (
              <Text className="text-white">No image</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={resetAndClose}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            className="absolute top-12 right-6 bg-white/20 rounded-full w-10 h-10 items-center justify-center"
          >
            <Text className="text-white text-lg">✕</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
