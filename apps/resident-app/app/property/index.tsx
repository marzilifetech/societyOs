import { useTheme } from '../../src/hooks/useTheme';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, FlatList } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type PropertyListing = {
  id: string;
  areaSqft: number;
  price: number;
  furnished: boolean;
  description?: string;
  status: 'PENDING' | 'ACTIVE' | 'WITHDRAWN' | 'SOLD';
  createdAt: string;
  resident?: { flat: { block: string; number: string } };
};

export default function PropertyScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [step, setStep] = useState<'list' | 'new' | 'community'>('list');
  const [areaSqft, setAreaSqft] = useState('');
  const [price, setPrice] = useState('');
  const [furnished, setFurnished] = useState(false);
  const [description, setDescription] = useState('');

  const { data: myListings, isLoading } = useQuery<PropertyListing[]>({
    queryKey: ['my-property-listings'],
    queryFn: () => api.get<PropertyListing[]>('/property/my'),
    enabled: step === 'list',
  });

  const { data: communityListings, isLoading: communityLoading } = useQuery<PropertyListing[]>({
    queryKey: ['property-listings'],
    queryFn: () => api.get<PropertyListing[]>('/property'),
    enabled: step === 'community',
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post<PropertyListing>('/property', {
        areaSqft: parseInt(areaSqft, 10),
        price: parseInt(price, 10),
        furnished,
        description,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-property-listings'] });
      qc.invalidateQueries({ queryKey: ['property-listings'] });
      Alert.alert('Submitted', 'Your listing has been submitted for approval.', [
        { text: 'OK', onPress: () => setStep('list') },
      ]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const expressInterest = useMutation({
    mutationFn: (id: string) => api.post(`/property/${id}/contact`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-listings'] });
      Alert.alert('Interest Expressed', 'The seller will be notified.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not express interest.'),
  });

  const isValid = areaSqft.length > 0 && price.length > 0;

  const renderListing = ({ item }: { item: PropertyListing }) => {
    const statusBadge =
      item.status === 'PENDING'
        ? { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Approval' }
        : item.status === 'ACTIVE'
          ? { bg: 'bg-green-100', text: 'text-green-700', label: 'Active Listing' }
          : item.status === 'SOLD'
            ? { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Sold' }
            : { bg: 'bg-red-100', text: 'text-red-700', label: 'Withdrawn' };
    return (
      <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center gap-2 flex-1">
            <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center">
              <Ionicons name="business" size={20} color="#821A52" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900">
                {item.resident?.flat.block}-{item.resident?.flat.number}
              </Text>
              <Text className="text-gray-500 text-sm">{item.areaSqft} sq ft • {item.furnished ? 'Furnished' : 'Unfurnished'}</Text>
            </View>
          </View>
          <Text className="text-primary-500 font-bold text-lg">₹{(item.price / 100000).toFixed(1)}L</Text>
        </View>
        {item.description && (
          <Text className="text-gray-600 text-sm mb-3" numberOfLines={2}>{item.description}</Text>
        )}
        {item.status === 'ACTIVE' && step === 'community' && (
          <TouchableOpacity
            className="mt-2 bg-primary-50 rounded-xl py-2 items-center flex-row justify-center gap-2"
            onPress={() => expressInterest.mutate(item.id)}
            disabled={expressInterest.isPending}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color="#821A52" />
            <Text className="text-primary-500 font-medium">Contact Seller</Text>
          </TouchableOpacity>
        )}
        <View className={`mt-2 self-start rounded-full px-2.5 py-1 ${statusBadge.bg}`}>
          <Text className={`text-xs font-medium ${statusBadge.text}`}>
            {statusBadge.label}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="flex-row items-center gap-3 mb-6">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2" accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color="#821A52" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900">Property</Text>
            <Text className="text-gray-500 text-sm">Buy or sell your apartment</Text>
          </View>
        </View>

        {/* Tab buttons */}
        <View className="flex-row gap-2 mb-6">
          {(['list', 'community', 'new'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-2 rounded-xl items-center ${
                step === tab ? 'bg-primary-500' : 'bg-gray-100 border border-gray-200'
              }`}
              onPress={() => setStep(tab)}
            >
              <Text className={`font-medium ${step === tab ? 'text-white' : 'text-gray-600'}`}>
                {tab === 'list' ? 'My Listings' : tab === 'community' ? 'Community' : 'List'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {step === 'list' && (
          isLoading ? (
            <ActivityIndicator color="#821A52" size="large" className="mt-12" />
          ) : (
            <>
              {myListings?.length === 0 ? (
                <View className="items-center py-12">
                  <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                    <Ionicons name="home" size={32} color="#821A52" />
                  </View>
                  <Text className="text-gray-900 font-semibold text-base">No listings yet</Text>
                  <Text className="text-gray-500 text-sm mt-1">List your apartment to find buyers</Text>
                </View>
              ) : (
                <FlatList
                  data={myListings}
                  renderItem={renderListing}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </>
          )
        )}

        {step === 'community' && (
          communityLoading ? (
            <ActivityIndicator color="#821A52" size="large" className="mt-12" />
          ) : (
            <>
              {communityListings?.length === 0 ? (
                <View className="items-center py-12">
                  <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                    <Ionicons name="search" size={32} color="#821A52" />
                  </View>
                  <Text className="text-gray-900 font-semibold text-base">No active listings</Text>
                  <Text className="text-gray-500 text-sm mt-1">Check back later</Text>
                </View>
              ) : (
                <FlatList
                  data={communityListings}
                  renderItem={renderListing}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </>
          )
        )}

        {step === 'new' && (
          <>
            <Text className="text-sm font-medium text-gray-700 mb-3">Area (sq ft) *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
              value={areaSqft}
              onChangeText={setAreaSqft}
              placeholder="e.g. 1200"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />

            <Text className="text-sm font-medium text-gray-700 mb-3">Price (₹) *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 8500000"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />

            <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 mb-4">
              <View className="flex-row items-center gap-3 flex-1">
                <Ionicons name="bed" size={20} color="#6B7280" />
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">Furnished</Text>
                  <Text className="text-gray-500 text-sm">Is the apartment furnished?</Text>
                </View>
              </View>
              <Switch
                value={furnished}
                onValueChange={setFurnished}
                trackColor={{ false: '#E5E7EB', true: '#F5D6E5' }}
                thumbColor={furnished ? '#821A52' : '#9CA3AF'}
              />
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-3">Description</Text>
            <TextInput
              className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
              value={description}
              onChangeText={setDescription}
              placeholder="Additional details..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              className={`rounded-2xl py-4 items-center ${isValid ? 'bg-primary-500' : 'bg-gray-200'}`}
              onPress={() => mutation.mutate()}
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-semibold text-base ${isValid ? 'text-white' : 'text-gray-400'}`}>
                  Submit Listing
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
