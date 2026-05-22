import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { DateField } from '../../src/components/common/DateField';

type TravelPause = {
  id: string;
  startDate: string;
  returnDate: string;
  actualReturnDate?: string;
  servicesPaused: string[];
  reason?: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
};

const SERVICES = [
  { id: 'DAILY', label: 'Daily Help', desc: 'Cook, housemaid, etc.' },
  { id: 'DELIVERY', label: 'Deliveries', desc: 'Packages & food' },
  { id: 'GUEST', label: 'Guests', desc: 'Visitors to your unit' },
  { id: 'AMENITY', label: 'Amenities', desc: 'Pool, gym, clubhouse' },
];

/** DD/MM/YYYY → ISO string for API */
function parseInDateToIso(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), 12, 0, 0));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function TravelScreen() {
  const qc = useQueryClient();
  const [step, setStep] = useState<'list' | 'new'>('list');
  const [startDate, setStartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [reason, setReason] = useState('');
  const [pausedServices, setPausedServices] = useState<string[]>([]);

  const toggleService = (id: string) => {
    setPausedServices((prev: any) => (prev.includes(id) ? prev.filter((s: any) => s !== id) : [...prev, id]));
  };

  const { data: pauses, isLoading, isError, refetch } = useQuery<TravelPause[]>({
    queryKey: ['my-travel-pauses'],
    queryFn: () => api.get<TravelPause[]>('/travel-pauses/my'),
    enabled: step === 'list',
  });

  const reportReturn = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/travel-pauses/${id}/return`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-travel-pauses'] });
      Alert.alert('Welcome back', 'Your travel pause has been ended.');
    },
    onError: () => Alert.alert('Error', 'Could not update your pause. Please try again.'),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const startIso = parseInDateToIso(startDate);
      const returnIso = parseInDateToIso(returnDate);
      if (!startIso || !returnIso) {
        return Promise.reject(new Error('INVALID_DATES'));
      }
      return api.post<TravelPause>('/travel-pauses', {
        startDate: startIso,
        returnDate: returnIso,
        servicesPaused: pausedServices,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-travel-pauses'] });
      setStep('list');
      setStartDate('');
      setReturnDate('');
      setReason('');
      setPausedServices([]);
      Alert.alert('Submitted', 'Your travel pause request is pending admin approval.');
    },
    onError: (e: Error) => {
      if (e.message === 'INVALID_DATES') {
        Alert.alert('Invalid dates', 'Use DD/MM/YYYY for both dates.');
        return;
      }
      Alert.alert('Error', 'Could not submit your request. Please try again.');
    },
  });

  const isValid =
    startDate.length >= 10 &&
    returnDate.length >= 10 &&
    pausedServices.length > 0 &&
    parseInDateToIso(startDate) !== null &&
    parseInDateToIso(returnDate) !== null;

  if (step === 'list') {
    if (isError) {
      return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
          <View className="w-16 h-16 rounded-2xl bg-red-100 items-center justify-center mb-4">
            <Ionicons name="alert-circle" size={32} color="#DC2626" />
          </View>
          <Text className="text-gray-900 text-lg font-semibold mb-1">Couldn't load requests</Text>
          <Text className="text-gray-500 text-center mb-6">Please check your connection and try again</Text>
          <TouchableOpacity
            className="bg-primary-500 px-6 py-3 rounded-2xl"
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading travel requests"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <View className="flex-row items-center gap-3 mb-6">
            <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2" accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={24} color="#821A52" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900">Travel Mode</Text>
              <Text className="text-gray-500 text-sm">Pause services while you're away</Text>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator color="#821A52" size="large" className="mt-12" />
          ) : (
            <>
              {pauses?.length === 0 ? (
                <View className="items-center py-12">
                  <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                    <Ionicons name="airplane" size={32} color="#821A52" />
                  </View>
                  <Text className="text-gray-900 font-semibold text-base">No travel pauses</Text>
                  <Text className="text-gray-500 text-sm mt-1">Submit a request when you plan to be away</Text>
                </View>
              ) : (
                <View className="gap-4">
                  {pauses?.map((pause: any) => {
                    const statusBadge =
                      pause.status === 'PENDING'
                        ? { bg: 'bg-amber-100', text: 'text-amber-700' }
                        : pause.status === 'ACTIVE'
                          ? { bg: 'bg-green-100', text: 'text-green-700' }
                          : { bg: 'bg-gray-100', text: 'text-gray-700' };
                    return (
                      <View key={pause.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                        <View className="flex-row justify-between items-start mb-2">
                          <View className="flex-row items-center gap-2 flex-1">
                            <Ionicons name="calendar" size={18} color="#6B7280" />
                            <View className="flex-1">
                              <Text className="font-semibold text-gray-900">
                                {new Date(pause.startDate).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                                {' – '}
                                {new Date(pause.returnDate).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </Text>
                              <Text className="text-gray-500 text-sm">{pause.servicesPaused.join(', ')}</Text>
                            </View>
                          </View>
                          <View className={`px-2 py-1 rounded-full ${statusBadge.bg}`}>
                            <Text className={`text-xs font-medium ${statusBadge.text}`}>
                              {pause.status}
                            </Text>
                          </View>
                        </View>
                        {pause.status === 'ACTIVE' && (
                          <TouchableOpacity
                            className="mt-2 bg-primary-50 rounded-xl py-2 items-center flex-row justify-center gap-2"
                            onPress={() => reportReturn.mutate(pause.id)}
                            disabled={reportReturn.isPending}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#821A52" />
                            <Text className="text-primary-500 font-medium">
                              {reportReturn.isPending ? 'Updating…' : "I'm Back — End Pause"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                className="bg-primary-500 rounded-2xl py-4 items-center mt-6 flex-row justify-center gap-2"
                onPress={() => setStep('new')}
              >
                <Ionicons name="pause-circle" size={20} color="#FFFFFF" />
                <Text className="text-white font-semibold text-base">Request Travel Pause</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="flex-row items-center gap-3 mb-6">
          <TouchableOpacity onPress={() => setStep('list')} className="p-2 -ml-2" accessibilityRole="button" accessibilityLabel="Back to list">
            <Ionicons name="chevron-back" size={24} color="#821A52" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900">New Request</Text>
        </View>

        <View className="mb-4">
          <DateField
            label="From Date *"
            value={startDate ? `${startDate.split('/').reverse().join('-')}T12:00:00.000Z` : null}
            onChange={(iso) => {
              const d = new Date(iso);
              setStartDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
            }}
            mode="date"
            minimumDate={new Date()}
          />
        </View>

        <View className="mb-4">
          <DateField
            label="To Date *"
            value={returnDate ? `${returnDate.split('/').reverse().join('-')}T12:00:00.000Z` : null}
            onChange={(iso) => {
              const d = new Date(iso);
              setReturnDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
            }}
            mode="date"
            minimumDate={new Date()}
          />
        </View>

        <Text className="text-sm font-medium text-gray-700 mb-3">Services to Pause *</Text>
        <View className="gap-2 mb-4">
          {SERVICES.map((svc: any) => {
            const selected = pausedServices.includes(svc.id);
            return (
              <TouchableOpacity
                key={svc.id}
                className={`flex-row items-center gap-3 p-4 rounded-xl border ${
                  selected ? 'bg-primary-50 border-primary-500' : 'bg-gray-50 border-gray-200'
                }`}
                onPress={() => toggleService(svc.id)}
              >
                <View
                  className={`w-5 h-5 rounded-full items-center justify-center ${
                    selected ? 'bg-primary-500' : 'border-2 border-gray-300'
                  }`}
                >
                  {selected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">{svc.label}</Text>
                  <Text className="text-gray-500 text-sm">{svc.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-sm font-medium text-gray-700 mb-3">Reason (Optional)</Text>
        <TextInput
          className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Vacation, family visit..."
          placeholderTextColor="#9CA3AF"
          multiline
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
              Submit Request
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
