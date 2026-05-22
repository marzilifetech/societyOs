import { View, Text, TouchableOpacity } from 'react-native';
import { StarStrip } from './StarStrip';

type Props = {
  review: {
    id: string;
    stars?: number;
    rating?: number;
    comment?: string;
    createdAt?: string;
    reviewer?: { name?: string; flat?: string | null };
    anonymous?: boolean;
  };
  onLongPress?: () => void;
};

export function ReviewCard({ review, onLongPress }: Props) {
  const stars = review.stars ?? review.rating ?? 0;
  const date = review.createdAt ? new Date(review.createdAt) : null;
  const reviewerLabel = review.anonymous
    ? 'Anonymous'
    : review.reviewer?.name
    ? `${review.reviewer.name}${review.reviewer.flat ? ` · ${review.reviewer.flat}` : ''}`
    : 'Resident';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={onLongPress}
      delayLongPress={400}
      className="bg-white rounded-2xl p-4 shadow-sm"
    >
      <View className="flex-row items-center justify-between mb-2">
        <StarStrip value={stars} />
        <Text className="text-xs text-gray-400">
          {date
            ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : '—'}
        </Text>
      </View>
      {review.comment && (
        <Text className="text-sm text-gray-700 leading-5 mb-2">{review.comment}</Text>
      )}
      <Text className="text-xs text-gray-400">— {reviewerLabel}</Text>
    </TouchableOpacity>
  );
}
