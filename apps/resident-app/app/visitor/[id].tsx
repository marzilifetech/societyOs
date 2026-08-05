import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Share, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { StatusPill, type RdStatusTone } from '../../src/components/ui';

// Status chips follow the StatusPill soft-tone vocabulary.
const STATUS_TONE: Record<string, RdStatusTone> = {
  EXPECTED: 'pending',
  CHECKED_IN: 'resolved',
  CHECKED_OUT: 'neutral',
  DENIED: 'cancelled',
};

export default function VisitorDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: visitor, isLoading } = useQuery({
    queryKey: ['visitor', id],
    queryFn: () => api.get<any>(`/visitors/${id}`),
  });

  const denyMutation = useMutation({
    mutationFn: () => api.patch(`/visitors/${id}/deny`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitor', id] });
      qc.invalidateQueries({ queryKey: ['my-visitors'] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not deny entry.'),
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
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Visitor not found</Text>
      </SafeAreaView>
    );
  }

  const statusTone = STATUS_TONE[visitor.status] ?? 'neutral';
  const isPending = visitor.status === 'EXPECTED';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mb-4"
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text className="font-bold text-gray-900 mb-1" style={{ fontSize: t.font2xl }}>Visitor Pass</Text>
          <View className="mt-1 mb-6">
            <StatusPill label={visitor.status.replace('_', ' ')} tone={statusTone} />
          </View>
        </View>

        {/* Gate pass QR */}
        {isPending && visitor.qrToken && (
          <View className="items-center mb-8 px-6">
            <View className="w-full rounded-2xl border border-gray-100 bg-white p-6 shadow-sm items-center">
              <Text className="text-center font-semibold uppercase tracking-[2px] text-primary-500 mb-5" style={{ fontSize: t.fontSm }}>
                Gate Pass
              </Text>
              <QRCode
                value={visitor.qrToken}
                size={200}
                color="#111827"
                backgroundColor="white"
              />
              <Text className="mt-4 font-mono font-bold tracking-[4px] text-gray-700" style={{ fontSize: 18 }}>
                {visitor.qrToken}
              </Text>
              <Text className="mt-3 text-center text-gray-500" style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeight }}>
                Show this to security at the gate.
              </Text>
            </View>
            <TouchableOpacity
              className="mt-4 bg-primary-50 rounded-full px-5"
              style={{ minHeight: t.touchTargetSm, justifyContent: 'center' }}
              onPress={() => {
                const validLine = visitor.validTill
                  ? `Valid until ${new Date(visitor.validTill).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Valid for 24 hours';
                Share.share({
                  message: `Gate pass for ${visitor.name ?? 'your visitor'}\nCode: ${visitor.qrToken}\n${validLine}\n\nShow this code at the gate.`,
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Share gate pass for ${visitor.name}`}
            >
              <Text className="text-primary-600 font-semibold" style={{ fontSize: t.fontSm }}>Share Pass</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Visitor details */}
        <View className="px-6 mb-6">
          <View className="bg-gray-50 rounded-2xl p-5 gap-4">
            <DetailRow label="Name" value={visitor.name} />
            {visitor.phone ? <DetailRow label="Phone" value={visitor.phone} /> : null}
            {visitor.purpose ? <DetailRow label="Purpose" value={visitor.purpose} /> : null}
            {visitor.vehicleNo ? <DetailRow label="Vehicle" value={visitor.vehicleNo} /> : null}
            <DetailRow
              label="Invited"
              value={new Date(visitor.createdAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            />
            {visitor.entryAt && (
              <DetailRow
                label="Checked In"
                value={new Date(visitor.entryAt).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              />
            )}
            {visitor.exitAt && (
              <DetailRow
                label="Checked Out"
                value={new Date(visitor.exitAt).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              />
            )}
          </View>
        </View>

        {/* Actions */}
        {isPending && (
          <View className="px-6 mb-8">
            <TouchableOpacity
              className="bg-red-50 border border-red-200 rounded-2xl py-4 items-center"
              onPress={() => denyMutation.mutate()}
              disabled={denyMutation.isPending}
              style={{ minHeight: t.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel={`Deny entry for ${visitor.name}`}
            >
              {denyMutation.isPending ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <Text className="text-red-600 font-semibold" style={{ fontSize: t.fontBase }}>Deny Entry</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View className="flex-row justify-between items-start">
      <Text className="text-gray-500 flex-1" style={{ fontSize: t.fontSm }}>{label}</Text>
      <Text className="font-medium text-gray-900 flex-1 text-right" style={{ fontSize: t.fontSm }}>{value}</Text>
    </View>
  );
}
