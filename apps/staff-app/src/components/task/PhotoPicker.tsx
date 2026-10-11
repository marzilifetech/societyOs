import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import type { PhotoAttachments } from '../../hooks/usePhotoAttachments';

/**
 * Taken photos with a remove button each, plus a camera tile. Pairs with
 * usePhotoAttachments.
 */
export function PhotoPicker({
  attachments,
  label,
  disabled,
}: {
  attachments: PhotoAttachments;
  /** e.g. "Tap to take a before photo". */
  label: string;
  disabled?: boolean;
}) {
  const { photos, takePhoto, removePhoto, isFull } = attachments;

  if (photos.length === 0) {
    return (
      <TouchableOpacity
        onPress={() => void takePhoto()}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-10 dark:border-gray-700"
      >
        <Ionicons name="camera-outline" size={36} color={colors.primary[500]} />
        <Text className="font-semibold text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {photos.map((uri, i) => (
        <View key={uri}>
          <Image
            source={{ uri }}
            style={{ width: 120, height: 120, borderRadius: 12 }}
            resizeMode="cover"
          />
          {!disabled ? (
            <TouchableOpacity
              onPress={() => removePhoto(uri)}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              hitSlop={8}
              className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/60"
            >
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      {!isFull && !disabled ? (
        <TouchableOpacity
          onPress={() => void takePhoto()}
          accessibilityRole="button"
          accessibilityLabel="Take another photo"
          className="h-[120px] w-[120px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700"
        >
          <Ionicons name="add" size={28} color={colors.primary[500]} />
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
