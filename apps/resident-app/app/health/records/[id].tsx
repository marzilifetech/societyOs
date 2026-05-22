import { View, Text, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';
import * as WebBrowser from 'expo-web-browser';

type HealthRecord = {
  id: string;
  name: string;
  type: string;
  date: string;
  uploadedAt: string;
  fileType: 'pdf' | 'image';
  url: string;
  shareUrl?: string;
};

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<HealthRecord>({
    queryKey: ['health-record', id],
    queryFn: () => api.get<HealthRecord>(`/health/records/${id}`),
  });

  const { mutate: deleteRecord, isPending: deleting } = useMutation({
    mutationFn: () => api.delete(`/health/records/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-records'] });
      router.back();
    },
    onError: () => Alert.alert('Error', 'Could not delete record.'),
  });

  const handleShare = () => {
    if (data?.shareUrl) {
      Alert.alert('Share Link', data.shareUrl);
    } else {
      Alert.alert('Share', 'Generating share link...');
    }
  };

  const handleOpen = async () => {
    if (data?.url) {
      await WebBrowser.openBrowserAsync(data.url);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1" numberOfLines={1}>{data?.name ?? 'Health Record'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {isLoading && (
          <>
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-64 mb-4" />
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-20 mb-3" />
          </>
        )}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
            <Text className="text-gray-500 text-base mb-3">Could not load record</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && (
          <>
            {/* File preview */}
            {data.fileType === 'image' ? (
              <Image
                source={{ uri: data.url }}
                className="w-full rounded-2xl mb-4"
                style={{ height: 300, backgroundColor: '#F3F4F6' }}
                resizeMode="contain"
              />
            ) : (
              <TouchableOpacity
                onPress={handleOpen}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-8 mb-4 items-center justify-center"
                style={{ height: 200 }}
              >
                <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                  <Ionicons name="document-text" size={32} color="#821A52" />
                </View>
                <Text className="text-gray-900 text-base font-semibold">Tap to open PDF</Text>
                <Text className="text-gray-500 text-sm mt-1">Opens in browser</Text>
              </TouchableOpacity>
            )}

            {/* Metadata */}
            <View className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-4">
              <MetaRow label="Type" value={data.type} />
              <MetaRow label="Date" value={new Date(data.date).toLocaleDateString()} />
              <MetaRow label="Uploaded" value={new Date(data.uploadedAt).toLocaleDateString()} />
            </View>

            {/* Actions */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleShare}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-4 items-center flex-row justify-center gap-2"
                style={{ minHeight: 56 }}
              >
                <Ionicons name="share-outline" size={18} color="#374151" />
                <Text className="text-gray-700 font-semibold">Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Delete', 'Are you sure you want to delete this record?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteRecord() },
                  ])
                }
                disabled={deleting}
                className="flex-1 bg-red-100 border border-red-200 rounded-xl py-4 items-center flex-row justify-center gap-2"
                style={{ minHeight: 56 }}
              >
                <Ionicons name="trash-outline" size={18} color="#B91C1C" />
                <Text className="text-red-700 font-semibold">Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-200 last:border-0">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className="text-gray-900 text-sm font-medium">{value}</Text>
    </View>
  );
}
