export {};

declare module 'react-native' {
  interface ImagePropsBase {
    className?: string;
    cssInterop?: boolean;
  }

  interface ViewProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface TextProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface TextInputProps {
    className?: string;
    placeholderClassName?: string;
    cssInterop?: boolean;
  }

  interface SwitchProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface InputAccessoryViewProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface TouchableWithoutFeedbackProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface ActivityIndicatorProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface StatusBarProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
    cssInterop?: boolean;
  }

  interface FlatListProps<ItemT> {
    className?: string;
    contentContainerClassName?: string;
    columnWrapperClassName?: string;
    cssInterop?: boolean;
  }

  interface PressableProps {
    className?: string;
    cssInterop?: boolean;
  }
}
