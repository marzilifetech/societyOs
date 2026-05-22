import { View } from 'react-native';

type Props = {
  height?: number;
  count?: number;
  className?: string;
  borderRadius?: number;
};

export function SkeletonPlaceholder({
  height = 60,
  count = 3,
  className,
  borderRadius = 12,
}: Props) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className={className ?? 'bg-gray-200'}
          style={{ height, borderRadius, marginBottom: 12 }}
        />
      ))}
    </>
  );
}
