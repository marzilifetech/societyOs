import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Amenity = {
  id: string;
  name: string;
  description: string;
  category: string;
  availableFrom: string;
  availableTo: string;
  maxCapacity: number;
  pricePerHour: number;
  status: string;
};

function generateSlots(from: string, to: string): string[] {
  const slots: string[] = [];
  const [fh] = (from || '06:00').split(':').map(Number);
  const [th] = (to || '22:00').split(':').map(Number);
  for (let h = fh; h < th; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function AmenityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedDate, setSelectedDate] = useState<'today' | 'tomorrow'>('today');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { data: amenity, isLoading, isError, refetch } = useQuery<Amenity>({
    queryKey: ['amenity', id],
    queryFn: () => api.get<Amenity>(`/amenities/${id}`),
  });

  const bookMutation = useMutation({
    mutationFn: (body: object) => api.post('/amenities/bookings', body),
    onSuccess: () => {
      Alert.alert('Booked!', 'Your amenity booking has been confirmed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      Alert.alert('Error', 'Could not complete the booking. Please try again.');
    },
  });

  const getDate = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const dateStr = selectedDate === 'today' ? getDate(0) : getDate(1);
  const slots = amenity ? generateSlots(amenity.availableFrom, amenity.availableTo) : [];

  const handleBook = () => {
    if (!selectedSlot) return;
    bookMutation.mutate({
      amenityId: id,
      date: dateStr,
      startTime: selectedSlot,
      endTime: addHour(selectedSlot),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-gray-900" numberOfLines={1}>{amenity?.name ?? 'Amenity'}</Text>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500 text-base">Loading…</Text>
        </View>
      )}

      {isError && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-gray-500 text-base mb-4">Could not load amenity</Text>
          <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {amenity && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 }}>
          {/* Info card */}
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
            {amenity.description ? (
              <Text className="text-sm text-gray-500" style={{ lineHeight: 20 }}>{amenity.description}</Text>
            ) : null}
            <View className="flex-row flex-wrap gap-x-5 gap-y-3 mt-3">
              <View>
                <Text className="text-xs text-gray-400">Hours</Text>
                <Text className="text-sm text-gray-900 font-semibold">{amenity.availableFrom} – {amenity.availableTo}</Text>
              </View>
              <View>
                <Text className="text-xs text-gray-400">Capacity</Text>
                <Text className="text-sm text-gray-900 font-semibold">{amenity.maxCapacity} people</Text>
              </View>
              {amenity.pricePerHour > 0 && (
                <View>
                  <Text className="text-xs text-gray-400">Price</Text>
                  <Text className="text-sm text-gray-900 font-semibold">₹{amenity.pricePerHour}/hr</Text>
                </View>
              )}
            </View>
          </View>

          {/* Date picker */}
          <Text className="text-xs font-semibold text-gray-500 mb-2.5">SELECT DATE</Text>
          <View className="flex-row gap-2.5 mb-5">
            {(['today', 'tomorrow'] as const).map((d) => {
              const selected = selectedDate === d;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => { setSelectedDate(d); setSelectedSlot(null); }}
                  className={`flex-1 rounded-xl py-3 items-center border ${selected ? 'bg-primary-500 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
                  style={{ minHeight: 52 }}
                >
                  <Text className={`font-semibold ${selected ? 'text-white' : 'text-gray-900'}`} style={{ fontSize: 15 }}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                  <Text className={`mt-0.5 ${selected ? 'text-white/80' : 'text-gray-400'}`} style={{ fontSize: 12 }}>
                    {getDate(d === 'today' ? 0 : 1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time slots */}
          <Text className="text-xs font-semibold text-gray-500 mb-2.5">SELECT TIME SLOT</Text>
          <View className="flex-row flex-wrap gap-2.5 mb-5">
            {slots.map((slot) => {
              const selected = selectedSlot === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  onPress={() => setSelectedSlot(selected ? null : slot)}
                  className={`rounded-xl px-3.5 py-2.5 items-center justify-center border ${selected ? 'bg-primary-500 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
                  style={{ minHeight: 52 }}
                >
                  <Text className={`font-semibold ${selected ? 'text-white' : 'text-gray-900'}`} style={{ fontSize: 13 }}>
                    {slot}
                  </Text>
                  <Text className={`mt-0.5 ${selected ? 'text-white/80' : 'text-gray-400'}`} style={{ fontSize: 11 }}>
                    – {addHour(slot)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notes */}
          <Text className="text-xs font-semibold text-gray-500 mb-2">NOTES (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any special requirements?"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="bg-gray-100 rounded-2xl text-gray-900 mb-6"
            style={{ fontSize: 15, padding: 14, minHeight: 80, textAlignVertical: 'top' }}
          />

          <TouchableOpacity
            onPress={handleBook}
            disabled={!selectedSlot || bookMutation.isPending}
            className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 ${selectedSlot ? 'bg-primary-500' : 'bg-gray-200'}`}
            style={{ minHeight: 56 }}
          >
            {selectedSlot && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            <Text className={`font-bold ${selectedSlot ? 'text-white' : 'text-gray-400'}`} style={{ fontSize: 17 }}>
              {bookMutation.isPending ? 'Booking…' : selectedSlot ? `Book ${selectedSlot} – ${addHour(selectedSlot)}` : 'Select a time slot'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
