import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type DocumentRequest = {
  id: string;
  type: string;
  status: string;
  requestedAt: string;
  url?: string;
};

const DOC_TYPES = ['NOC', 'Possession Letter', 'Maintenance Receipt', 'Society Certificate', 'Other'];

const STATUS_META: Record<string, { badgeClass: string; label: string }> = {
  PENDING: { badgeClass: 'bg-amber-100 text-amber-700', label: 'Pending' },
  PROCESSING: { badgeClass: 'bg-primary-50 text-primary-500', label: 'Processing' },
  READY: { badgeClass: 'bg-green-100 text-green-700', label: 'Ready' },
  REJECTED: { badgeClass: 'bg-red-100 text-red-700', label: 'Rejected' },
};

export default function DocumentsScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading, isError, refetch } = useQuery<DocumentRequest[]>({
    queryKey: ['document-requests'],
    queryFn: () => api.get<DocumentRequest[]>('/document-requests/my'),
  });

  const requestMutation = useMutation({
    mutationFn: (body: object) => api.post('/document-requests', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-requests'] });
      setShowForm(false);
      setSelectedType('');
      setNotes('');
      Alert.alert('Requested', 'Your document request has been submitted.');
    },
    onError: () => Alert.alert('Error', 'Could not submit request. Please try again.'),
  });

  const handleSubmit = () => {
    if (!selectedType) { Alert.alert('Required', 'Please select a document type.'); return; }
    requestMutation.mutate({ type: selectedType, notes: notes.trim() || undefined });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[52px] justify-center mr-3 flex-row items-center">
          <Ionicons name="chevron-back" size={20} color="#821A52" />
          <Text className="text-primary-500 text-base ml-1">Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-3xl font-bold">Documents</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Request official society documents</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          className="min-h-[52px] justify-center bg-primary-500 rounded-2xl px-4 flex-row items-center"
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={16} color="#FFFFFF" />
          <Text className="text-white font-bold text-sm ml-1">{showForm ? 'Close' : 'New'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {showForm && (
          <View className="bg-primary-50 rounded-2xl border border-primary-200 p-4 mb-5">
            <Text className="text-gray-900 text-lg font-bold mb-3.5">New Document Request</Text>
            <Text className="text-gray-700 text-xs font-semibold mb-2.5">DOCUMENT TYPE *</Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {DOC_TYPES.map((t: any) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setSelectedType(t)}
                  className={`rounded-xl px-3 py-2.5 min-h-[44px] justify-center border ${
                    selectedType === t ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`font-semibold text-xs ${selectedType === t ? 'text-white' : 'text-gray-700'}`}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-gray-700 text-xs font-semibold mb-2">NOTES</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any specific details…"
              placeholderTextColor="#9CA3AF"
              multiline
              className="bg-gray-100 rounded-2xl border border-gray-200 text-gray-900 text-base p-3.5 mb-3.5"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={requestMutation.isPending}
              className="bg-primary-500 rounded-2xl py-3.5 items-center min-h-[52px]"
            >
              <Text className="text-white text-base font-bold">
                {requestMutation.isPending ? 'Submitting…' : 'Submit Request'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading && [1, 2, 3].map((i: any) => (
          <View key={i} className="bg-gray-50 rounded-2xl mb-2.5" style={{ height: 80 }} />
        ))}

        {isError && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-6 items-center">
            <Text className="text-gray-700 text-base mb-3">Could not load requests</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && !showForm && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-8 items-center mt-5">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="document-text" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold">No requests yet</Text>
            <Text className="text-gray-500 text-sm text-center mt-2">Tap + New to request a document</Text>
          </View>
        )}

        {data?.map((req: any) => {
          const meta = STATUS_META[req.status] ?? STATUS_META.PENDING;
          const [bgClass, textClass] = meta.badgeClass.split(' ');
          return (
            <TouchableOpacity
              key={req.id}
              className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-2.5 flex-row items-center"
              onPress={() => router.push(`/documents/${req.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`View details for ${req.type}`}
            >
              <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center mr-3">
                <Ionicons name="document-text" size={22} color="#821A52" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-base font-bold">{req.type}</Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {new Date(req.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
                {req.url && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="cloud-download-outline" size={12} color="#821A52" />
                    <Text className="text-primary-500 text-xs font-semibold ml-1">Download Available</Text>
                  </View>
                )}
              </View>
              <View className={`${bgClass} rounded-lg px-2.5 py-1`}>
                <Text className={`${textClass} text-xs font-bold`}>{meta.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
