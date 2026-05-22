import { View, Text, TouchableOpacity } from 'react-native';

type Phase = { id: string; label: string };

type Props = {
  phases: Phase[];
  value: string;
  onChange: (id: string) => void;
};

export function PhaseChips({ phases, value, onChange }: Props) {
  return (
    <View className="flex-row gap-2 self-center bg-black/40 rounded-full p-1">
      {phases.map((p) => (
        <TouchableOpacity
          key={p.id}
          className={`px-4 py-1.5 rounded-full ${value === p.id ? 'bg-white' : ''}`}
          onPress={() => onChange(p.id)}
        >
          <Text
            className={`text-xs font-semibold ${value === p.id ? 'text-gray-900' : 'text-white'}`}
          >
            {p.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
