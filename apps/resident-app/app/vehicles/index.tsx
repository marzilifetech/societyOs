import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;

type VehicleType = 'CAR' | 'TWO_WHEELER' | 'SUV';

type Vehicle = {
  id: string;
  plateNumber: string;
  make?: string;
  model?: string;
  color?: string;
  type: VehicleType;
};

type EntryLog = {
  id: string;
  vehicleId?: string;
  plateNumber?: string;
  entryTime?: string;
  exitTime?: string;
  type?: string;
};

type CreateVehicleForm = {
  plateNumber: string;
  make: string;
  model: string;
  color: string;
  type: VehicleType;
};

const VEHICLE_TYPES: { label: string; value: VehicleType }[] = [
  { label: 'Car', value: 'CAR' },
  { label: 'Two Wheeler', value: 'TWO_WHEELER' },
  { label: 'SUV', value: 'SUV' },
];

const TYPE_ICON: Record<VehicleType, IoniconName> = {
  CAR: 'car',
  TWO_WHEELER: 'bicycle',
  SUV: 'bus',
};

export default function VehiclesScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateVehicleForm>({ plateNumber: '', make: '', model: '', color: '', type: 'CAR' });

  const { data: vehicles, isLoading, isError, refetch: refetchVehicles } = useQuery<Vehicle[]>({
    queryKey: ['vehicles-my'],
    queryFn: () => api.get<Vehicle[]>('/vehicles'),
  });

  const { data: entryLog, refetch: refetchLog } = useQuery<EntryLog[]>({
    queryKey: ['vehicle-entry-log'],
    queryFn: () => api.get<EntryLog[]>('/vehicles/entry-log').catch(() => []),
  });

  const addMutation = useMutation<Vehicle, Error, CreateVehicleForm>({
    mutationFn: (data: any) => api.post<Vehicle>('/vehicles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles-my'] });
      setForm({ plateNumber: '', make: '', model: '', color: '', type: 'CAR' });
      setShowForm(false);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const removeMutation = useMutation<void, Error, string>({
    mutationFn: (id: any) => api.delete<void>(`/vehicles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles-my'] });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchVehicles(), refetchLog()]);
    setRefreshing(false);
  };

  const confirmRemove = (id: string, plate: string) => {
    Alert.alert('Remove Vehicle', `Remove ${plate}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(id) },
    ]);
  };

  const isFormValid = form.plateNumber.trim().length >= 2;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">My Vehicles</Text>
          <Text className="text-sm text-gray-500">Registered vehicles</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm((v: any) => !v)}
          className={`rounded-xl px-4 py-2 ${showForm ? 'bg-primary-50 border border-primary-500' : 'bg-primary-500'}`}
        >
          <Text className={`font-semibold text-sm ${showForm ? 'text-primary-500' : 'text-white'}`}>{showForm ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Add Vehicle Form */}
        {showForm && (
          <View className="mx-6 mb-5 rounded-2xl p-5 bg-gray-50 border border-gray-200">
            <Text className="text-base font-semibold text-gray-900 mb-4">Add Vehicle</Text>

            <Field label="Plate Number *" value={form.plateNumber} onChange={(v: any) => setForm((f: any) => ({ ...f, plateNumber: v }))} placeholder="e.g. MH 01 AB 1234" />
            <Field label="Make" value={form.make} onChange={(v: any) => setForm((f: any) => ({ ...f, make: v }))} placeholder="e.g. Honda" />
            <Field label="Model" value={form.model} onChange={(v: any) => setForm((f: any) => ({ ...f, model: v }))} placeholder="e.g. City" />
            <Field label="Color" value={form.color} onChange={(v: any) => setForm((f: any) => ({ ...f, color: v }))} placeholder="e.g. White" />

            <Text className="text-xs font-medium text-gray-500 mb-2">Type</Text>
            <View className="flex-row gap-2 mb-4">
              {VEHICLE_TYPES.map((vt: { label: string; value: VehicleType }) => {
                const selected = form.type === vt.value;
                return (
                  <TouchableOpacity
                    key={vt.value}
                    onPress={() => setForm((f: any) => ({ ...f, type: vt.value }))}
                    className={`flex-1 rounded-xl py-2.5 items-center border ${selected ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-200'}`}
                  >
                    <Ionicons name={TYPE_ICON[vt.value]} size={18} color={selected ? '#821A52' : '#9CA3AF'} />
                    <Text className={`font-medium mt-1 ${selected ? 'text-primary-500' : 'text-gray-500'}`} style={{ fontSize: 11 }}>{vt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              className={`rounded-xl py-3.5 items-center ${isFormValid ? 'bg-primary-500' : 'bg-gray-200'}`}
              onPress={() => addMutation.mutate(form)}
              disabled={!isFormValid || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-semibold ${isFormValid ? 'text-white' : 'text-gray-400'}`}>Add Vehicle</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Vehicle List */}
        {isLoading ? (
          <View className="items-center py-20">
            <ActivityIndicator color="#821A52" size="large" />
          </View>
        ) : isError ? (
          <View className="items-center py-10 px-8">
            <Text className="text-base text-gray-500 mb-3">Failed to load vehicles</Text>
            <TouchableOpacity onPress={() => refetchVehicles()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !vehicles?.length ? (
          <View className="mx-6 rounded-2xl p-8 items-center bg-gray-50 border border-gray-200">
            <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
              <Ionicons name="car" size={32} color="#821A52" />
            </View>
            <Text className="text-base font-semibold text-gray-900 mb-1">No vehicles registered</Text>
            <Text className="text-sm text-gray-500 text-center">Tap + Add to register your vehicle</Text>
          </View>
        ) : (
          <View className="px-6 gap-3">
            {vehicles.map((v: Vehicle) => (
              <View
                key={v.id}
                className="rounded-2xl p-4 bg-gray-50 border border-gray-200"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-xl bg-primary-50 items-center justify-center">
                    <Ionicons name={TYPE_ICON[v.type] ?? 'car'} size={24} color="#821A52" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-gray-900">{v.plateNumber}</Text>
                    {(v.make || v.model) ? (
                      <Text className="text-sm text-gray-500 mt-0.5">{[v.make, v.model].filter(Boolean).join(' ')}</Text>
                    ) : null}
                    <View className="flex-row gap-2 mt-1">
                      {v.color ? <Text className="text-xs text-primary-500">{v.color}</Text> : null}
                      <Text className="text-xs text-gray-400">{v.type.replace('_', ' ')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmRemove(v.id, v.plateNumber)}
                    className="p-2"
                  >
                    <Text className="text-sm text-red-600">Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Entry/Exit Log */}
        {entryLog?.length ? (
          <View className="px-6 mt-8">
            <Text className="text-xl font-semibold text-gray-900 mb-3">Entry / Exit Log</Text>
            <View className="rounded-2xl overflow-hidden bg-gray-50 border border-gray-200">
              {entryLog.map((log: any, idx: any) => (
                <View
                  key={log.id}
                  style={{ borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 12 }}
                  className="flex-row items-center justify-between"
                >
                  <View>
                    <Text className="font-semibold text-sm text-gray-900">{log.plateNumber ?? '—'}</Text>
                    {log.entryTime ? (
                      <Text className="text-xs text-green-700 mt-0.5">In: {new Date(log.entryTime).toLocaleString()}</Text>
                    ) : null}
                    {log.exitTime ? (
                      <Text className="text-xs text-amber-700 mt-0.5">Out: {new Date(log.exitTime).toLocaleString()}</Text>
                    ) : null}
                  </View>
                  {log.type ? <Text className="text-xs text-gray-400">{log.type}</Text> : null}
                </View>
              ))}
            </View>
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
