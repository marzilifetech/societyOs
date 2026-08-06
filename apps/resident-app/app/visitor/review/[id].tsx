import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';
import { useTheme } from '../../../src/hooks/useTheme';

type Visitor = {
  id: string;
  name?: string;
  phone?: string;
  purpose?: string;
  photoUrl?: string;
  createdAt?: string;
  status?: string;
  type?: 'GUEST' | 'DELIVERY';
  deliveryPartner?: string | null;
};

type Decision = 'APPROVE' | 'REJECT' | 'LEAVE_AT_SECURITY';

/**
 * Live arrival approval screen. Reached by tapping a VISITOR_ARRIVAL push.
 * Approve/Deny call POST /visitors/:id/decision { action }.
 */
export default function VisitorReviewScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: visitor, isLoading } = useQuery<Visitor>({
    queryKey: ['visitor', id],
    queryFn: () => api.get<Visitor>(`/visitors/${id}`),
    enabled: !!id,
  });

  const decisionMutation = useMutation<void, Error, Decision>({
    mutationFn: (action) =>
      api.post<void>(`/visitors/${id}/decision`, { action }),
    onSuccess: (_data, action) => {
      qc.invalidateQueries({ queryKey: ['visitor', id] });
      qc.invalidateQueries({ queryKey: ['my-visitors'] });
      const { title, body } =
        action === 'APPROVE'
          ? {
              title: 'Entry Approved',
              body: 'Security has been notified to let them in.',
            }
          : action === 'LEAVE_AT_SECURITY'
          ? {
              title: 'Leave at Security',
              body: 'Security will keep the package at the desk.',
            }
          : {
              title: 'Entry Denied',
              body: 'Security has been notified to deny entry.',
            };
      Alert.alert(title, body, [{ text: 'OK', onPress: () => router.back() }]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not submit your decision.'),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={t.accentPrimary} />
      </SafeAreaView>
    );
  }

  if (!visitor) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-gray-500 text-center mb-4">This visitor request is no longer available.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="flex-row items-center gap-1"
        >
          <Ionicons name="chevron-back" size={18} color={t.accentPrimary} />
          <Text className="text-primary-500" style={{ fontSize: t.fontBase }}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const arrivedAt = visitor.createdAt
    ? new Date(visitor.createdAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;
  const busy = decisionMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View className="px-6 pt-4 pb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mb-4"
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text className="font-bold text-gray-900 mb-1" style={{ fontSize: t.font2xl }}>Visitor at the Gate</Text>
          <Text className="text-gray-500" style={{ fontSize: t.fontSm }}>
            Someone is requesting entry. Please approve or deny.
          </Text>
        </View>

        <View className="items-center px-6 mt-4 mb-8">
          {visitor.photoUrl ? (
            <Image
              source={{ uri: visitor.photoUrl }}
              style={{ width: 120, height: 120, borderRadius: 60 }}
              accessibilityLabel={`Photo of ${visitor.name ?? 'visitor'}`}
            />
          ) : (
            <View
              className="bg-primary-50 items-center justify-center"
              style={{ width: 120, height: 120, borderRadius: 60 }}
            >
              <Text className="text-primary-500 font-bold" style={{ fontSize: 40 }}>
                {(visitor.name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text className="font-bold text-gray-900 mt-5" style={{ fontSize: t.fontXl }}>
            {visitor.name ?? 'Visitor'}
          </Text>
          {visitor.type === 'DELIVERY' && visitor.deliveryPartner ? (
            <View className="bg-amber-100 rounded-full px-3 py-1 mt-2">
              <Text className="text-amber-800 font-bold text-xs uppercase" style={{ letterSpacing: 1 }}>
                {visitor.deliveryPartner}
              </Text>
            </View>
          ) : null}
          {visitor.purpose ? (
            <Text className="text-gray-600 mt-1 text-center" style={{ fontSize: t.fontBase }}>{visitor.purpose}</Text>
          ) : null}
          {visitor.phone ? (
            <Text className="text-gray-400 mt-1" style={{ fontSize: t.fontSm }}>{visitor.phone}</Text>
          ) : null}
          {arrivedAt ? (
            <Text className="text-gray-400 mt-2" style={{ fontSize: t.fontSm }}>Arrived {arrivedAt}</Text>
          ) : null}
        </View>

        <View className="flex-1" />

        <View className="px-6 mb-8 gap-3">
          <TouchableOpacity
            className="bg-primary-500 rounded-full items-center justify-center"
            style={{ minHeight: t.touchTargetLg }}
            onPress={() => decisionMutation.mutate('APPROVE')}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Approve entry for ${visitor.name ?? 'visitor'}`}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold" style={{ fontSize: t.fontBase }}>
                {visitor.type === 'DELIVERY' ? 'Approve & let them in' : 'Approve Entry'}
              </Text>
            )}
          </TouchableOpacity>
          {/* Third option only appears for deliveries — for guests there's
              no "leave at security" alternative. */}
          {visitor.type === 'DELIVERY' && (
            <TouchableOpacity
              className="bg-amber-500 rounded-full items-center justify-center"
              style={{ minHeight: t.touchTargetLg }}
              onPress={() => decisionMutation.mutate('LEAVE_AT_SECURITY')}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Leave at security"
            >
              <Text className="text-white font-semibold" style={{ fontSize: t.fontBase }}>
                Leave at security
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="bg-red-50 border border-red-200 rounded-full items-center justify-center"
            style={{ minHeight: t.touchTargetLg }}
            onPress={() => decisionMutation.mutate('REJECT')}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Deny entry for ${visitor.name ?? 'visitor'}`}
          >
            <Text className="text-red-600 font-semibold" style={{ fontSize: t.fontBase }}>
              {visitor.type === 'DELIVERY' ? 'Reject' : 'Deny Entry'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
