import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';

type IoniconName = keyof typeof Ionicons.glyphMap;

type ServiceRequestSummary = {
  id: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#EFF6FF', text: '#2563EB', label: 'Pending' },
  ASSIGNED: { bg: '#F5F3FF', text: '#7C3AED', label: 'Assigned' },
  IN_PROGRESS: { bg: '#FFFBEB', text: '#D97706', label: 'In Progress' },
  COMPLETED: { bg: '#F0FDF4', text: '#16A34A', label: 'Completed' },
  REJECTED: { bg: '#FEF2F2', text: '#DC2626', label: 'Rejected' },
  CLOSED: { bg: '#F3F4F6', text: '#6B7280', label: 'Closed' },
};

const CATEGORIES: { icon: IoniconName; label: string; tint: string }[] = [
  { icon: 'water', label: 'Plumbing', tint: '#0EA5E9' },
  { icon: 'flash', label: 'Electrical', tint: '#F59E0B' },
  { icon: 'snow', label: 'AC/HVAC', tint: '#06B6D4' },
  { icon: 'hammer', label: 'Carpentry', tint: '#A16207' },
  { icon: 'sparkles', label: 'Cleaning', tint: '#10B981' },
  { icon: 'swap-vertical', label: 'Lift', tint: '#6366F1' },
  { icon: 'shield-checkmark', label: 'Security', tint: '#7C3AED' },
  { icon: 'leaf', label: 'Gardening', tint: '#16A34A' },
];

export default function ServicesScreen() {
  const t = useTheme();
  const { data: requests, isLoading } = useQuery<ServiceRequestSummary[]>({
    queryKey: ['my-service-requests'],
    queryFn: () => api.get<ServiceRequestSummary[]>('/service-requests/my'),
  });

  const active = requests?.filter((r: ServiceRequestSummary) => !['COMPLETED', 'CLOSED', 'REJECTED'].includes(r.status));
  const past = requests?.filter((r: ServiceRequestSummary) => ['COMPLETED', 'CLOSED', 'REJECTED'].includes(r.status));

  const tileHeight = t.touchTarget >= 68 ? 100 : 80;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={[]}
        keyExtractor={() => 'list'}
        ListHeaderComponent={
          <View>
            <View className="px-6 pt-4 pb-3 flex-row justify-between items-center">
              <Text className="text-2xl font-bold text-gray-900">Services</Text>
              <TouchableOpacity
                className="bg-primary-500 rounded-xl px-4"
                style={{ minHeight: t.touchTargetSm, justifyContent: 'center' }}
                onPress={() => router.push('/services/new' as any)}
                accessibilityRole="button"
                accessibilityLabel="Create new service request"
              >
                <Text className="text-white font-semibold" style={{ fontSize: t.fontSm }}>+ Request</Text>
              </TouchableOpacity>
            </View>

            {/* Categories */}
            <View className="px-6 mb-4">
              <Text className="text-gray-700 font-semibold mb-3" style={{ fontSize: t.fontBase }}>Categories</Text>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.label}
                    className="bg-white rounded-xl px-3 flex-row items-center gap-2 shadow-sm"
                    style={{ minHeight: tileHeight, paddingVertical: 8 }}
                    onPress={() => router.push({ pathname: '/services/new', params: { category: cat.label } } as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`Request ${cat.label} service`}
                  >
                    <View
                      className="w-9 h-9 rounded-lg items-center justify-center"
                      style={{ backgroundColor: `${cat.tint}1A` }}
                    >
                      <Ionicons name={cat.icon} size={18} color={cat.tint} />
                    </View>
                    <Text className="text-gray-700" style={{ fontSize: t.fontSm }}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Active requests */}
            {active && active.length > 0 && (
              <View className="px-6 mb-2">
                <Text className="text-gray-700 font-semibold mb-3" style={{ fontSize: t.fontBase }}>Active ({active.length})</Text>
                {active.map((req: ServiceRequestSummary) => (
                  <RequestCard key={req.id} req={req} />
                ))}
              </View>
            )}

            {/* Past requests */}
            {past && past.length > 0 && (
              <View className="px-6">
                <Text className="text-gray-500 font-semibold mb-3" style={{ fontSize: t.fontBase }}>History</Text>
                {past.map((req: ServiceRequestSummary) => (
                  <RequestCard key={req.id} req={req} />
                ))}
              </View>
            )}

            {!isLoading && !requests?.length && (
              <View className="items-center mt-12 px-6">
                <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                  <Ionicons name="construct" size={32} color="#821A52" />
                </View>
                <Text className="text-gray-700 font-semibold" style={{ fontSize: t.fontBase }}>No requests yet</Text>
                <Text className="text-gray-400 mt-1 text-center" style={{ fontSize: t.fontSm }}>
                  Raise a service request and we'll get it sorted
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={() => null}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}

function RequestCard({ req }: { req: ServiceRequestSummary }) {
  const t = useTheme();
  const c = STATUS_CONFIG[req.status] ?? { bg: '#F3F4F6', text: '#6B7280', label: req.status };
  return (
    <TouchableOpacity
      className="bg-white rounded-2xl px-4 py-4 mb-3 shadow-sm"
      style={{ minHeight: t.touchTarget }}
      onPress={() => router.push(`/services/${req.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`View ${req.category} service request, status ${c.label}`}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-2">
          <Text className="font-semibold text-gray-900 capitalize" style={{ fontSize: t.fontBase }}>{req.category}</Text>
          <Text className="text-gray-500 mt-0.5" style={{ fontSize: t.fontSm }} numberOfLines={2}>
            {req.description}
          </Text>
          <Text className="text-gray-400 mt-1" style={{ fontSize: t.fontXs }}>
            {new Date(req.createdAt).toLocaleDateString('en-IN')}
          </Text>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.bg }}>
          <Text className="font-medium" style={{ color: c.text, fontSize: t.fontSm }}>
            {c.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
