import { View, Text, TouchableOpacity } from 'react-native';

const TEMPLATES = [
  'Replaced O-ring',
  'Cleaned drain',
  'Tightened fitting',
  'Replaced gasket',
  'Bled air from line',
  'Tested water pressure',
  'Replaced washer',
  'Sealed leak',
];

type Props = {
  onSelect: (text: string) => void;
};

export function MaterialsChecklist({ onSelect }: Props) {
  return (
    <View>
      <Text className="text-xs font-semibold text-gray-500 mb-2">Quick paste</Text>
      <View className="flex-row flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => onSelect(t)}
            className="bg-blue-50 rounded-full px-3 py-1.5"
          >
            <Text className="text-xs text-blue-700">{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
