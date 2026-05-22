import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  OPEN: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Raised' },
  UNDER_REVIEW: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Under Review' },
  RESOLVED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Resolved' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Closed' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

export default function ComplaintsScreen() {
  const t = useTheme();
  const { data: complaints, isLoading } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: () => api.get<any[]>('/complaints/my'),
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="p-1 -ml-1"
          >
            <Ionicons name="chevron-back" size={24} color="#821A52" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900">Complaints</Text>
            <Text className="mt-1 text-gray-500" style={{ fontSize: t.fontSm }}>Track issues raised with your society office</Text>
          </View>
        </View>
        <TouchableOpacity
          className="rounded-2xl bg-primary-500 px-4"
          style={{ minHeight: t.touchTarget, justifyContent: 'center' }}
          onPress={() => router.push('/complaints/new' as any)}
          accessibilityRole="button"
          accessibilityLabel="Create new complaint"
        >
          <Text className="font-semibold text-white" style={{ fontSize: t.fontSm }}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={complaints}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.OPEN;

          return (
            <TouchableOpacity
              className="mb-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-4"
              style={{ minHeight: t.touchTarget }}
              onPress={() => router.push(`/complaints/${item.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`View complaint: ${item.title}`}
            >
              <View className="flex-row items-start justify-between">
                <View className="mr-3 flex-1">
                  <Text className="font-semibold text-gray-900" style={{ fontSize: t.fontBase }}>{item.title}</Text>
                  <Text className="mt-1 text-gray-500" style={{ fontSize: t.fontSm }}>{item.category}</Text>
                  <Text className="mt-2 text-gray-600" style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeight }} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
                <View className={`rounded-full px-3 py-1 ${meta.bg}`}>
                  <Text className={`font-semibold ${meta.text}`} style={{ fontSize: t.fontSm }}>
                    {meta.label}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center px-8 py-20">
              <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="chatbubble-ellipses" size={32} color="#821A52" />
              </View>
              <Text className="text-lg font-semibold text-gray-900">No complaints filed</Text>
              <Text className="mt-2 text-center text-gray-500" style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeight }}>
                If something in the society needs attention, raise it here and track the progress.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
