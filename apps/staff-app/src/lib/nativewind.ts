import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

// SafeAreaView comes from a third-party package, so NativeWind needs explicit
// interop for className styles to apply at runtime.
cssInterop(SafeAreaView, {
  className: 'style',
});
