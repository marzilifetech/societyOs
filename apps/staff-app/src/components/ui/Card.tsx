import type { ReactNode } from 'react';
import { Text, View, type ViewProps } from 'react-native';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

type CardProps = ViewProps & {
  /** Inner padding — defaults to `md` (16). Use `none` for list groups with their own rows. */
  padding?: CardPadding;
  className?: string;
};

/**
 * The one card surface for the staff app: white in light mode, gray-900 in
 * dark, soft 24px corners, hairline tinted border. Replaces the many ad-hoc
 * `bg-white rounded-2xl shadow-sm` variants.
 */
export function Card({ padding = 'md', className = '', children, ...rest }: CardProps) {
  return (
    <View
      className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-black/5 dark:border-gray-800 ${PADDING[padding]} ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}

/** Montserrat card title — keeps headings visually distinct from Lato body copy. */
export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Text className={`font-heading text-sm text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </Text>
  );
}
