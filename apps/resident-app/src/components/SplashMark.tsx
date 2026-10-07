import { View } from 'react-native';

/**
 * The launcher-icon mark — a white centre dot ringed by six smaller dots —
 * drawn with plain Views.
 *
 * WHY NOT THE PNG
 * ---------------
 * The boot screen must put this mark exactly where the Android OS splash and
 * the window background put it, on the very first frame. A 1024px bitmap
 * decodes asynchronously, and every arrangement tried around that left a
 * visible gap: the logo blinking out for ~0.4s, or the image's maroon square
 * painting over Home during the hand-off. Views draw in the same frame as
 * the screen around them: no decode, no gap, sharp at any density.
 *
 * Geometry measured from assets/adaptive-icon.png (1024px canvas, the source
 * of the launcher foreground). If the launcher icon changes, re-measure.
 */
const CANVAS = 1024;
const WHITE = '#FFFFFF';
const GREY = '#D5D5D5';

export const SPLASH_MARK_DOTS = [
  { x: 400, y: 330.5, d: 93, color: GREY },
  { x: 625.5, y: 330.5, d: 94, color: WHITE },
  { x: 298, y: 512.5, d: 93, color: WHITE },
  { x: 512.5, y: 512.5, d: 184, color: WHITE },
  { x: 727, y: 512.5, d: 93, color: GREY },
  { x: 400, y: 694.5, d: 93, color: GREY },
  { x: 625.5, y: 694.5, d: 94, color: WHITE },
] as const;

type SplashMarkProps = {
  /** Side of the square the launcher icon occupies, in dp. */
  size: number;
  testID?: string;
};

export function SplashMark({ size, testID }: SplashMarkProps) {
  const scale = size / CANVAS;
  return (
    <View style={{ width: size, height: size }} testID={testID}>
      {SPLASH_MARK_DOTS.map((dot) => {
        const d = dot.d * scale;
        return (
          <View
            key={`${dot.x}-${dot.y}`}
            style={{
              position: 'absolute',
              left: dot.x * scale - d / 2,
              top: dot.y * scale - d / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: dot.color,
            }}
          />
        );
      })}
    </View>
  );
}
