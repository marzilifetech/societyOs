import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Subscription = {
  id: string;
  type: string;
  provider: string;
  quantity: number;
  frequency: string;
  status: string;
  startDate: string;
};

const TYPE_ICONS: Record<string, IoniconName> = {
  NEWSPAPER: 'newspaper',
  MILK: 'cafe',
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  ACTIVE: { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Active' },
  PAUSED: { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Paused' },
  CANCELLED: { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Cancelled' },
};

export default function SubscriptionsScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'NEWSPAPER' | 'MILK'>('NEWSPAPER');
  const [provider, setProvider] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [frequency, setFrequency] = useState('DAILY');

  const { data, isLoading, isError, refetch } = useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: () => api.get<Subscription[]>('/subscriptions'),
  });

  const addMutation = useMutation({
    mutationFn: (body: object) => api.post('/subscriptions', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      setShowForm(false);
      setProvider('');
      setQuantity('1');
    },
    onError: () => Alert.alert('Error', 'Could not add subscription.'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/subscriptions/${id}/${action}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
    onError: () => Alert.alert('Error', 'Action failed. Please try again.'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAdd = () => {
    if (!provider.trim()) { Alert.alert('Required', 'Please enter a provider name.'); return; }
    addMutation.mutate({ type, provider: provider.trim(), quantity: parseInt(quantity, 10) || 1, frequency });
  };

  const active = data?.filter((s: any) => s.status !== 'CANCELLED') ?? [];
  const cancelled = data?.filter((s: any) => s.status === 'CANCELLED') ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">Subscriptions</Text>
          <Text className="text-sm text-gray-500 mt-0.5">Newspaper & milk deliveries</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          className="bg-primary-500 rounded-xl px-3.5 h-11 flex-row items-center justify-center gap-1"
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={18} color="#FFFFFF" />
          <Text className="text-white font-bold text-sm">{showForm ? 'Close' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {showForm && (
          <View className="bg-primary-50 border border-primary-100 rounded-3xl p-4 mb-5">
            <Text className="text-gray-900 text-lg font-bold mb-3.5">Add Subscription</Text>

            <Text className="text-gray-500 text-xs font-semibold mb-2 tracking-wide">TYPE</Text>
            <View className="flex-row gap-2.5 mb-4">
              {(['NEWSPAPER', 'MILK'] as const).map((tt) => (
                <TouchableOpacity
                  key={tt}
                  onPress={() => setType(tt)}
                  className={`flex-1 rounded-xl py-3 items-center justify-center min-h-[60px] border ${type === tt ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'}`}
                >
                  <Ionicons name={TYPE_ICONS[tt]} size={22} color={type === tt ? '#FFFFFF' : '#821A52'} />
                  <Text className={`text-xs font-semibold mt-1 ${type === tt ? 'text-white' : 'text-gray-700'}`}>{tt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-gray-500 text-xs font-semibold mb-2 tracking-wide">PROVIDER</Text>
            <TextInput
              value={provider}
              onChangeText={setProvider}
              placeholder="e.g. Times of India, Mother Dairy"
              placeholderTextColor="#9CA3AF"
              className="bg-gray-100 rounded-2xl border border-gray-200 text-gray-900 text-[15px] p-3.5 min-h-[52px] mb-3.5"
            />

            <View className="flex-row gap-3 mb-3.5">
              <View className="flex-1">
                <Text className="text-gray-500 text-xs font-semibold mb-2 tracking-wide">QUANTITY</Text>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                  className="bg-gray-100 rounded-2xl border border-gray-200 text-gray-900 text-[15px] p-3.5 min-h-[52px]"
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-xs font-semibold mb-2 tracking-wide">FREQUENCY</Text>
                <View className="flex-row gap-1.5">
                  {['DAILY', 'WEEKLY'].map((f) => (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setFrequency(f)}
                      className={`flex-1 rounded-xl py-3 items-center justify-center min-h-[52px] border ${frequency === f ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'}`}
                    >
                      <Text className={`text-xs font-semibold ${frequency === f ? 'text-white' : 'text-gray-700'}`}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleAdd}
              disabled={addMutation.isPending}
              className="bg-primary-500 rounded-2xl py-4 items-center"
            >
              <Text className="text-white text-base font-bold">
                {addMutation.isPending ? 'Adding…' : 'Add Subscription'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading && [1, 2].map((i: any) => (
          <View key={i} className="bg-gray-50 rounded-3xl h-24 mb-3" />
        ))}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-3xl p-6 items-center">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="alert-circle" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-500 text-base mb-3">Could not load subscriptions</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && !showForm && (
          <View className="bg-gray-50 border border-gray-200 rounded-3xl p-8 items-center mt-5">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="repeat" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold">No subscriptions</Text>
            <Text className="text-gray-500 text-sm text-center mt-2">Tap + Add to set up newspaper or milk delivery</Text>
          </View>
        )}

        {active.length > 0 && (
          <>
            <Text className="text-gray-500 text-xs font-semibold mb-2.5 mt-2 tracking-wide">ACTIVE</Text>
            {active.map((sub: any) => <SubCard key={sub.id} sub={sub} onAction={(action: any) => actionMutation.mutate({ id: sub.id, action })} />)}
          </>
        )}

        {cancelled.length > 0 && (
          <>
            <Text className="text-gray-500 text-xs font-semibold mb-2.5 mt-4 tracking-wide">CANCELLED</Text>
            {cancelled.map((sub: any) => <SubCard key={sub.id} sub={sub} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SubCard({ sub, onAction }: { sub: Subscription; onAction?: (action: string) => void }) {
  const meta = STATUS_META[sub.status] ?? STATUS_META.ACTIVE;
  const icon: IoniconName = TYPE_ICONS[sub.type] ?? 'cube';
  return (
    <View className="bg-gray-50 border border-gray-200 rounded-3xl p-4 mb-2.5">
      <View className="flex-row items-center mb-2.5">
        <View className="w-12 h-12 rounded-xl bg-primary-50 items-center justify-center mr-3">
          <Ionicons name={icon} size={22} color="#821A52" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 text-base font-bold">{sub.provider}</Text>
          <Text className="text-gray-500 text-[13px] mt-0.5">
            {sub.type} · Qty {sub.quantity} · {sub.frequency}
          </Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${meta.bgClass}`}>
          <Text className={`text-[11px] font-bold ${meta.textClass}`}>{meta.label}</Text>
        </View>
      </View>
      {onAction && sub.status !== 'CANCELLED' && (
        <View className="flex-row gap-2">
          {sub.status === 'ACTIVE' && (
            <TouchableOpacity
              onPress={() => onAction('pause')}
              className="flex-1 rounded-xl py-2.5 items-center justify-center min-h-[44px] border border-amber-200 bg-amber-50 flex-row gap-1.5"
            >
              <Ionicons name="pause" size={14} color="#D97706" />
              <Text className="text-amber-700 font-semibold text-[13px]">Pause</Text>
            </TouchableOpacity>
          )}
          {sub.status === 'PAUSED' && (
            <TouchableOpacity
              onPress={() => onAction('resume')}
              className="flex-1 rounded-xl py-2.5 items-center justify-center min-h-[44px] border border-green-200 bg-green-50 flex-row gap-1.5"
            >
              <Ionicons name="play" size={14} color="#16A34A" />
              <Text className="text-green-700 font-semibold text-[13px]">Resume</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onAction('cancel')}
            className="flex-1 rounded-xl py-2.5 items-center justify-center min-h-[44px] border border-red-200 bg-red-50 flex-row gap-1.5"
          >
            <Ionicons name="close" size={14} color="#DC2626" />
            <Text className="text-red-600 font-semibold text-[13px]">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
