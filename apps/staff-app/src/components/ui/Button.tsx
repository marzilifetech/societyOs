import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { colors } from '@societyos/theme';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-primary-500 dark:bg-primary-600',
  secondary: 'bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600',
  destructive: 'bg-red-600 dark:bg-red-700',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-900 dark:text-gray-100',
  destructive: 'text-white',
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Shows a spinner in place of the label and disables presses. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Pill button: berry primary, white-bordered secondary, red destructive. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`rounded-full px-6 py-3.5 items-center justify-center ${CONTAINER[variant]} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' ? colors.primary[500] : '#FFFFFF'}
        />
      ) : (
        <Text className={`font-semibold text-sm ${LABEL[variant]}`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
