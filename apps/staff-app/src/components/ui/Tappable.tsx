import { useCallback, useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  /** Base style. Always applied. */
  style?: StyleProp<ViewStyle>;
  /** Extra style layered on top while the user is holding the row down. */
  pressedStyle?: StyleProp<ViewStyle>;
};

/**
 * Pressable with press feedback that survives the NativeWind interop.
 *
 * React Native supports `style={({ pressed }) => ...}` on Pressable, but
 * react-native-css-interop (NativeWind 4.1.x, which this app is pinned to —
 * see below) SILENTLY DROPS the function form: the style is never applied and
 * the element falls back to defaults. The failure is invisible in review
 * because the code is idiomatic RN and TypeScript accepts it; it only shows up
 * on device as a row whose `flexDirection: 'row'` vanished and whose children
 * stack vertically.
 *
 * Why we can't just upgrade NativeWind: the launch-hang fix pins this app to
 * the old architecture (`newArchEnabled: false`), which pins
 * react-native-reanimated to 3.x, which pins react-native-css-interop to
 * 0.1.22 (0.2.x hard-codes the Reanimated 4 worklets Babel plugin). So the
 * interop bug is a fixed constraint, not something to wait out.
 *
 * Diagnosed on the resident app by bisecting one element at a time on-device:
 * function form → broken, static object → fine, array-with-falsy-entries
 * (`[a, cond && b]`) → fine. Only the function form is affected, which is why
 * this wrapper reimplements it with local state.
 *
 * Use this instead of a bare Pressable whenever you want pressed feedback.
 */
export function Tappable({ style, pressedStyle, onPressIn, onPressOut, children, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);

  const handleIn = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      setPressed(true);
      onPressIn?.(e);
    },
    [onPressIn],
  );

  const handleOut = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      setPressed(false);
      onPressOut?.(e);
    },
    [onPressOut],
  );

  return (
    <Pressable
      {...rest}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[style, pressed && pressedStyle]}
    >
      {children}
    </Pressable>
  );
}
