import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type ParkingSlot = {
  id: string;
  slotNumber: string;
  type: string;
  location?: string;
  isOccupied?: boolean;
};

type GuestParking = {
  id: string;
  vehiclePlate: string;
  visitorName?: string;
  notes?: string;
  createdAt: string;
  status?: string;
};

type GuestParkingForm = {
  vehiclePlate: string;
  visitorName: string;
  notes: string;
};

export default function ParkingScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GuestParkingForm>({ vehiclePlate: '', visitorName: '', notes: '' });

  const { data: mySlots, isLoading, isError, refetch: refetchSlots } = useQuery<ParkingSlot[]>({
    queryKey: ['parking-my'],
    queryFn: () => api.get<ParkingSlot[]>('/parking/my'),
  });

  const { data: guestHistory, refetch: refetchGuest } = useQuery<GuestParking[]>({
    queryKey: ['parking-guest-history'],
    queryFn: () => api.get<GuestParking[]>('/parking/guest-history').catch(() => []),
  });

  const mutation = useMutation<GuestParking, Error, GuestParkingForm>({
    mutationFn: (data: any) => api.post<GuestParking>('/parking/guest', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parking-guest-history'] });
      setForm({ vehiclePlate: '', visitorName: '', notes: '' });
      setShowForm(false);
      Alert.alert('Success', 'Guest parking requested successfully');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSlots(), refetchGuest()]);
    setRefreshing(false);
  };

  const isFormValid = form.vehiclePlate.trim().length >= 2;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">Parking</Text>
          <Text className="text-sm text-gray-500">Your slots and guest parking</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* My Parking Slots */}
        <Text className="px-6 text-xl font-semibold text-gray-900 mb-3">My Slots</Text>

        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#821A52" size="large" />
          </View>
        ) : isError ? (
          <View className="items-center py-10 px-8">
            <Text className="text-base text-gray-500 mb-3">Failed to load parking slots</Text>
            <TouchableOpacity onPress={() => refetchSlots()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !mySlots?.length ? (
          <View className="mx-6 mb-6 rounded-2xl p-6 items-center bg-gray-50 border border-gray-200">
            <View className="w-14 h-14 rounded-full bg-primary-50 items-center justify-center mb-3">
              <Ionicons name="car" size={28} color="#821A52" />
            </View>
            <Text className="text-sm text-gray-500">No parking slots assigned</Text>
          </View>
        ) : (
          <View className="px-6 gap-3 mb-6">
            {mySlots.map((slot: any) => (
              <View
                key={slot.id}
                className="rounded-2xl p-5 bg-gray-50 border border-gray-200"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-3">
                    <View className="w-11 h-11 rounded-xl bg-primary-50 items-center justify-center">
                      <Ionicons name="car" size={22} color="#821A52" />
                    </View>
                    <Text className="text-2xl font-bold text-primary-500">{slot.slotNumber}</Text>
                  </View>
                  {slot.isOccupied !== undefined && (
                    <View className={`rounded-full px-2.5 py-1 ${slot.isOccupied ? 'bg-red-100' : 'bg-green-100'}`}>
                      <Text className={`text-xs font-semibold ${slot.isOccupied ? 'text-red-700' : 'text-green-700'}`}>
                        {slot.isOccupied ? 'Occupied' : 'Available'}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-row gap-4">
                  {slot.type ? (
                    <Text className="text-sm text-gray-500">Type: <Text className="text-gray-900">{slot.type}</Text></Text>
                  ) : null}
                  {slot.location ? (
                    <Text className="text-sm text-gray-500">Location: <Text className="text-gray-900">{slot.location}</Text></Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Guest Parking */}
        <View className="px-6 flex-row items-center justify-between mb-3">
          <Text className="text-xl font-semibold text-gray-900">Guest Parking</Text>
          <TouchableOpacity
            onPress={() => setShowForm((v: any) => !v)}
            className={`rounded-xl px-4 py-2 ${showForm ? 'bg-primary-50 border border-primary-500' : 'bg-primary-500'}`}
          >
            <Text className={`font-semibold text-sm ${showForm ? 'text-primary-500' : 'text-white'}`}>{showForm ? 'Cancel' : '+ Request'}</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View className="mx-6 mb-5 rounded-2xl p-5 bg-gray-50 border border-gray-200">
            <Text className="text-base font-semibold text-gray-900 mb-4">Request Guest Parking</Text>

            <Field label="Vehicle Plate *" value={form.vehiclePlate} onChange={(v: any) => setForm((f: any) => ({ ...f, vehiclePlate: v }))} placeholder="e.g. MH 01 AB 1234" />
            <Field label="Visitor Name" value={form.visitorName} onChange={(v: any) => setForm((f: any) => ({ ...f, visitorName: v }))} placeholder="e.g. Rajan Mehta" />
            <Field label="Notes" value={form.notes} onChange={(v: any) => setForm((f: any) => ({ ...f, notes: v }))} placeholder="Optional notes" />

            <TouchableOpacity
              className={`rounded-xl py-3.5 items-center mt-2 ${isFormValid ? 'bg-primary-500' : 'bg-gray-200'}`}
              onPress={() => mutation.mutate(form)}
              disabled={!isFormValid || mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-semibold ${isFormValid ? 'text-white' : 'text-gray-400'}`}>Request Parking</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Guest Parking History */}
        {guestHistory?.length ? (
          <View className="px-6 gap-3">
            <Text className="text-sm font-medium text-gray-500 mb-1">Recent Guest Requests</Text>
            {guestHistory.map((entry: any) => (
              <View
                key={entry.id}
                className="rounded-2xl p-4 bg-gray-50 border border-gray-200"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="car" size={16} color="#821A52" />
                    <Text className="font-semibold text-gray-900">{entry.vehiclePlate}</Text>
                  </View>
                  {entry.status ? (
                    <View className="bg-blue-100 rounded-full px-2.5 py-1">
                      <Text className="text-blue-700 text-xs font-medium">{entry.status}</Text>
                    </View>
                  ) : null}
                </View>
                {entry.visitorName ? <Text className="text-sm text-gray-500 mt-1">{entry.visitorName}</Text> : null}
                <Text className="text-xs text-gray-400 mt-1">{new Date(entry.createdAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-medium text-gray-500 mb-1.5">{label}</Text>
      <TextInput
        className="bg-gray-100 rounded-xl px-3.5 py-3 text-gray-900"
        style={{ fontSize: 15 }}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}
