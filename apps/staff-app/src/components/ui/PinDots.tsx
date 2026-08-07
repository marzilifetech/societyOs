import { View } from 'react-native';

/**
 * Four filled/empty dots showing PIN progress.
 *
 * Replaces a `secureTextEntry` TextInput that rendered "••••" as its
 * PLACEHOLDER: because the placeholder looked identical to a filled PIN, the
 * field appeared to already contain four digits before the user typed
 * anything, and there was no feedback at all as they typed. Drawing the dots
 * ourselves makes progress unambiguous.
 */
export function PinDots({
  length,
  filled,
  error,
}: {
  length: number;
  filled: number;
  error?: boolean;
}) {
  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}
      accessibilityLabel={`${filled} of ${length} digits entered`}
    >
      {Array.from({ length }).map((_, i) => {
        const on = i < filled;
        return (
          <View
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              borderWidth: 2,
              borderColor: error ? '#FCA5A5' : on ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
              backgroundColor: on ? (error ? '#FCA5A5' : '#FFFFFF') : 'transparent',
            }}
          />
        );
      })}
    </View>
  );
}
