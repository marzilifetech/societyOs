import { Text, TouchableOpacity, View } from 'react-native';

export type FilterChipOption<T extends string = string> = {
  id: T;
  label: string;
};

type FilterChipsProps<T extends string> = {
  options: readonly FilterChipOption<T>[];
  selected: T;
  onSelect: (id: T) => void;
  className?: string;
};

/** The shared segment row: capsule chips, berry when active. */
export function FilterChips<T extends string>({
  options,
  selected,
  onSelect,
  className = '',
}: FilterChipsProps<T>) {
  return (
    <View className={`flex-row flex-wrap gap-2 ${className}`}>
      {options.map((option) => {
        const active = option.id === selected;
        return (
          <TouchableOpacity
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`px-3.5 py-1.5 rounded-full border ${
              active
                ? 'bg-primary-500 dark:bg-primary-600 border-primary-500 dark:border-primary-600'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
