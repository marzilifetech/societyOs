import { View } from 'react-native';

export function SkeletonCard({ height = 80 }: { height?: number }) {
  return (
    <View
      className="bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse"
      style={{ height }}
    />
  );
}

export function SkeletonRow() {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl h-16 animate-pulse" />
      <View className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl h-16 animate-pulse" />
      <View className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl h-16 animate-pulse" />
    </View>
  );
}
