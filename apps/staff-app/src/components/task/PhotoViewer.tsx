import { Modal, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

export function PhotoViewer({ visible, uri, onClose }: Props) {
  const { width, height } = Dimensions.get('window');

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.5, savedScale.value * e.scale);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      } else {
        savedScale.value = scale.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const resetAndClose = () => {
    scale.value = 1;
    savedScale.value = 1;
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black">
          <TouchableOpacity className="flex-1 items-center justify-center" onPress={resetAndClose} activeOpacity={1}>
            {uri ? (
              <GestureDetector gesture={pinchGesture}>
                <Animated.Image source={{ uri }} style={[{ width, height: height * 0.85 }, animatedStyle]} resizeMode="contain" />
              </GestureDetector>
            ) : (
              <Text className="text-white">No image</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={resetAndClose}
            className="absolute top-12 right-6 bg-white/20 rounded-full w-10 h-10 items-center justify-center"
          >
            <Text className="text-white text-lg">✕</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
