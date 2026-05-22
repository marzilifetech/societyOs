import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

type Mode = 'date' | 'time' | 'datetime';

interface Props {
  label?: string;
  value: string | null; // ISO string or HH:MM (when mode='time')
  onChange: (iso: string) => void;
  mode?: Mode;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** When true, store result as 'HH:MM' (24h) — useful for medication reminders. */
  timeAsHHMM?: boolean;
}

function formatDisplay(value: string | null, mode: Mode, timeAsHHMM?: boolean): string {
  if (!value) return '';
  if (mode === 'time') {
    if (timeAsHHMM) return value;
    const d = new Date(value);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  if (mode === 'date') {
    const d = new Date(value);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const d = new Date(value);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Cross-platform date/time picker button. Replaces free-text date inputs.
 * Stores ISO string in parent state on confirm (or HH:MM if timeAsHHMM).
 */
export function DateField({ label, value, onChange, mode = 'date', placeholder, minimumDate, maximumDate, timeAsHHMM }: Props) {
  const [show, setShow] = useState(false);

  const initial = (() => {
    if (value) {
      if (mode === 'time' && timeAsHHMM) {
        const m = value.match(/^(\d{2}):(\d{2})$/);
        if (m) {
          const d = new Date();
          d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
          return d;
        }
      }
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  })();

  const handleChange = (_: unknown, selected?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (!selected) return;
    if (mode === 'time' && timeAsHHMM) {
      const hh = String(selected.getHours()).padStart(2, '0');
      const mm = String(selected.getMinutes()).padStart(2, '0');
      onChange(`${hh}:${mm}`);
      return;
    }
    onChange(selected.toISOString());
  };

  const display = formatDisplay(value, mode, timeAsHHMM);
  const iconName = mode === 'time' ? 'time-outline' : 'calendar-outline';

  return (
    <View>
      {label && <Text className="text-gray-500 text-xs font-semibold mb-2 uppercase tracking-wide">{label}</Text>}
      <TouchableOpacity
        onPress={() => setShow(true)}
        className="bg-gray-100 border border-gray-200 rounded-xl px-4 flex-row items-center"
        style={{ minHeight: 52, paddingVertical: 14 }}
        accessibilityRole="button"
        accessibilityLabel={label ? `Pick ${label}` : 'Pick date'}
      >
        <Ionicons name={iconName} size={18} color="#6B7280" />
        <Text className={`ml-2 flex-1 text-base ${display ? 'text-gray-900' : 'text-gray-400'}`}>
          {display || placeholder || (mode === 'time' ? 'Pick time' : 'Pick date')}
        </Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={initial}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {/* iOS spinner stays visible — provide a Done button. */}
      {show && Platform.OS === 'ios' && (
        <TouchableOpacity
          onPress={() => setShow(false)}
          className="self-end mt-2 px-4 py-2 bg-primary-500 rounded-lg"
          accessibilityRole="button"
          accessibilityLabel="Done picking date"
        >
          <Text className="text-white font-semibold">Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
