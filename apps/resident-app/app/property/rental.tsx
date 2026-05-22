import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert, Switch, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { DateField } from '../../src/components/common/DateField';

type RentalListing = {
  id: string;
  rentAmount: number;
  availableFrom: string;
  furnished: boolean;
  description?: string;
  status: 'ACTIVE' | 'RENTED' | 'INACTIVE';
  createdAt: string;
};

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  RENTED: { bg: 'bg-primary-50', text: 'text-primary-500', label: 'Rented' },
  INACTIVE: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactive' },
};

export default function RentalScreen() {
  const qc = useQueryClient();
  const [rentAmount, setRentAmount] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [furnished, setFurnished] = useState(false);
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: existing, isLoading, isError, refetch } = useQuery<RentalListing | null>({
    queryKey: ['my-rental'],
    queryFn: () => api.get<RentalListing | null>('/property/my-rental'),
  });

  const mutation = useMutation({
    mutationFn: (body: object) => api.post('/property', { ...body, kind: 'RENTAL' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-rental'] });
      Alert.alert('Listed!', 'Your flat has been listed for rent.', [{ text: 'OK' }]);
      setEditing(false);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSubmit = () => {
    if (!rentAmount.trim()) { Alert.alert('Required', 'Please enter the rent amount.'); return; }
    if (!availableFrom.trim()) { Alert.alert('Required', 'Please enter the available from date.'); return; }
    mutation.mutate({
      rentAmount: parseInt(rentAmount, 10),
      availableFrom: availableFrom.trim(),
      furnished,
      description: description.trim() || undefined,
    });
  };

  const startEdit = (listing: RentalListing) => {
    setRentAmount(String(listing.rentAmount));
    setAvailableFrom(listing.availableFrom.slice(0, 10));
    setFurnished(listing.furnished);
    setDescription(listing.description ?? '');
    setEditing(true);
  };

  const showForm = !existing || editing;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center gap-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 -ml-1"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">List for Rent</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80, paddingTop: 16 }}
      >
        {/* Existing listing */}
        {isLoading && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl mb-6" style={{ height: 120 }} />
        )}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 items-center mb-6">
            <View className="w-14 h-14 rounded-2xl bg-red-100 items-center justify-center mb-3">
              <Ionicons name="alert-circle" size={28} color="#DC2626" />
            </View>
            <Text className="text-gray-500 text-base mb-4">Could not load existing listing</Text>
            <TouchableOpacity
              onPress={() => refetch()}
              className="bg-primary-500 rounded-xl px-6 py-3"
              accessibilityRole="button"
              accessibilityLabel="Retry loading listing"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && existing && !editing && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6">
            <View className="flex-row justify-between items-start mb-3">
              <View className="flex-row items-center gap-2 flex-1">
                <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center">
                  <Ionicons name="home" size={20} color="#821A52" />
                </View>
                <Text className="text-gray-900 text-lg font-extrabold flex-1">
                  ₹{existing.rentAmount.toLocaleString('en-IN')}/mo
                </Text>
              </View>
              <View className={`rounded-full px-2.5 py-1 ${STATUS_META[existing.status]?.bg ?? 'bg-gray-100'}`}>
                <Text className={`text-xs font-bold ${STATUS_META[existing.status]?.text ?? 'text-gray-600'}`}>
                  {STATUS_META[existing.status]?.label ?? existing.status}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2 mb-1">
              <Ionicons name="calendar" size={14} color="#6B7280" />
              <Text className="text-gray-500 text-sm">
                Available from: {new Date(existing.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <View className="flex-row items-center gap-2" style={{ marginBottom: existing.description ? 10 : 0 }}>
              <Ionicons name="bed" size={14} color="#6B7280" />
              <Text className="text-gray-500 text-sm">
                {existing.furnished ? 'Furnished' : 'Unfurnished'}
              </Text>
            </View>
            {existing.description ? (
              <Text className="text-gray-600 text-sm mb-3">{existing.description}</Text>
            ) : null}
            <TouchableOpacity
              onPress={() => startEdit(existing)}
              className="bg-primary-50 rounded-xl py-3 items-center mt-2"
              accessibilityRole="button"
              accessibilityLabel="Edit listing"
            >
              <Text className="text-primary-500 font-bold">Edit Listing</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form */}
        {showForm && (
          <>
            {editing && (
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-gray-900 text-base font-bold">Update Listing</Text>
                <TouchableOpacity
                  onPress={() => setEditing(false)}
                  className="px-2 py-2"
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing"
                >
                  <Text className="text-gray-400 text-sm">Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text className="text-gray-500 text-xs font-bold mb-2">RENT AMOUNT (₹/month) *</Text>
            <TextInput
              value={rentAmount}
              onChangeText={setRentAmount}
              placeholder="e.g. 35000"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              className="bg-gray-100 border border-gray-200 rounded-xl px-4 text-gray-900 text-base mb-5"
              style={{ minHeight: 52, paddingVertical: 14 }}
            />

            <View className="mb-5">
              <DateField label="Available From *" value={availableFrom} onChange={setAvailableFrom} mode="date" minimumDate={new Date()} />
            </View>

            <View className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 flex-row justify-between items-center mb-5">
              <View className="flex-row items-center gap-3 flex-1">
                <Ionicons name="bed" size={20} color="#6B7280" />
                <View className="flex-1">
                  <Text className="text-gray-900 text-base font-semibold">Furnished</Text>
                  <Text className="text-gray-500 text-xs">Is the flat furnished?</Text>
                </View>
              </View>
              <Switch
                value={furnished}
                onValueChange={setFurnished}
                trackColor={{ false: '#E5E7EB', true: '#F5D6E5' }}
                thumbColor={furnished ? '#821A52' : '#9CA3AF'}
              />
            </View>

            <Text className="text-gray-500 text-xs font-bold mb-2">DESCRIPTION</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Additional details about the flat…"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base mb-7"
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={mutation.isPending}
              className="bg-primary-500 rounded-2xl py-4 items-center"
              style={{ minHeight: 56 }}
            >
              <Text className="text-white text-base font-bold">
                {mutation.isPending ? 'Submitting…' : editing ? 'Update Listing' : 'List for Rent'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
