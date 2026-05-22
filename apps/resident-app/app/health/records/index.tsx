import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;
type HealthRecord = { id: string; name: string; type: string; date: string; fileType: string };
type RecordsData = {
  prescriptions: HealthRecord[];
  labReports: HealthRecord[];
  scans: HealthRecord[];
  vaccination: HealthRecord[];
  insurance: HealthRecord[];
};

const CATEGORIES: { key: keyof RecordsData; label: string; icon: IoniconName; tint: string }[] = [
  { key: 'prescriptions', label: 'Prescriptions', icon: 'document-text', tint: '#7C3AED' },
  { key: 'labReports', label: 'Lab Reports', icon: 'flask', tint: '#0EA5E9' },
  { key: 'scans', label: 'Scans & Imaging', icon: 'scan', tint: '#F97316' },
  { key: 'vaccination', label: 'Vaccination', icon: 'medical', tint: '#16A34A' },
  { key: 'insurance', label: 'Insurance', icon: 'shield-checkmark', tint: '#0891B2' },
];

export default function HealthRecordsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<RecordsData>({
    queryKey: ['health-records'],
    queryFn: () => api.get<RecordsData>('/health/records'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Health Records</Text>
        <TouchableOpacity
          onPress={() => router.push('/health/records/upload' as any)}
          className="bg-primary-500 rounded-xl px-4 py-3 flex-row items-center gap-1"
          style={{ minHeight: 48 }}
        >
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text className="text-white font-semibold text-sm">Upload</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {isLoading && CATEGORIES.map((c) => (
          <View key={c.key} className="mb-6">
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-6 w-32 mb-3" />
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-16 mb-2" />
          </View>
        ))}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center mt-4">
            <Text className="text-gray-500 text-base mb-3">Could not load records</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && CATEGORIES.map((cat) => {
          const records = data[cat.key];
          return (
            <View key={cat.key} className="mb-6">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center gap-2">
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center"
                    style={{ backgroundColor: `${cat.tint}1A` }}
                  >
                    <Ionicons name={cat.icon} size={16} color={cat.tint} />
                  </View>
                  <Text className="text-gray-900 text-base font-bold">{cat.label}</Text>
                </View>
                {records.length > 3 && (
                  <TouchableOpacity>
                    <Text className="text-primary-500 text-sm font-semibold">View all ({records.length})</Text>
                  </TouchableOpacity>
                )}
              </View>

              {records.length === 0 ? (
                <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 items-center">
                  <Text className="text-gray-400 text-sm">No {cat.label.toLowerCase()} uploaded</Text>
                </View>
              ) : (
                records.slice(0, 3).map((rec) => (
                  <TouchableOpacity
                    key={rec.id}
                    onPress={() => router.push(`/health/records/${rec.id}` as any)}
                    className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-2 flex-row items-center"
                    style={{ minHeight: 64 }}
                  >
                    <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center mr-3">
                      <Ionicons name={rec.fileType === 'pdf' ? 'document-text' : 'image'} size={20} color="#821A52" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-900 text-sm font-semibold" numberOfLines={1}>{rec.name}</Text>
                      <Text className="text-gray-500 text-xs mt-0.5">{new Date(rec.date).toLocaleDateString()}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
