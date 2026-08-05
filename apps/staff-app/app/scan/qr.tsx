import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView } from 'expo-camera';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { AppHeader, Card } from '../../src/components/ui';

type Visitor = {
  id: string;
  name: string;
  purpose?: string;
  approvalStatus?: string;
  status?: string;
  validUntil?: string;
  resident?: { flat?: { number?: string; block?: string } };
};

function flatLabel(visitor: Visitor): string {
  const flat = visitor.resident?.flat;
  if (!flat) return '—';
  return [flat.block, flat.number].filter(Boolean).join('-') || '—';
}

export default function QrScanScreen() {
  const qc = useQueryClient();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  const lookup = useMutation({
    mutationFn: (qr: string) => api.get<Visitor>(`/visitors/qr/${qr}`),
    onSuccess: (data) => {
      setVisitor(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: (err: any) => {
      Alert.alert('Invalid QR', err.message, [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/staff/visitors/${id}/approve`, {}),
    onSuccess: (data) => {
      setVisitor(data as Visitor);
      qc.invalidateQueries({ queryKey: ['staff-visitors-pending'] });
      qc.invalidateQueries({ queryKey: ['staff-visitors-pending-count'] });
      Alert.alert('Approved', 'Visitor can now be checked in.');
    },
    onError: (err: any) => Alert.alert('Could not approve', err?.message ?? 'Try again'),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/staff/visitors/${id}/reject`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-visitors-pending'] });
      qc.invalidateQueries({ queryKey: ['staff-visitors-pending-count'] });
      Alert.alert('Rejected', undefined, [
        {
          text: 'OK',
          onPress: () => {
            setScanned(false);
            setVisitor(null);
            setToken(null);
          },
        },
      ]);
    },
    onError: (err: any) => Alert.alert('Could not reject', err?.message ?? 'Try again'),
  });

  const decision = useMutation({
    mutationFn: ({ allow }: { allow: boolean }) =>
      api.post('/visitors/check-in', {
        qrToken: token,
        decision: allow ? 'ALLOW' : 'DENY',
      }),
    onSuccess: (_data, vars) => {
      Alert.alert(vars.allow ? 'Entry Allowed ✓' : 'Entry Denied', undefined, [
        {
          text: 'OK',
          onPress: () => {
            setScanned(false);
            setVisitor(null);
            setToken(null);
          },
        },
      ]);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanned || lookup.isPending) return;
    setScanned(true);
    setToken(data);
    lookup.mutate(data);
  };

  const resetScan = () => {
    setScanned(false);
    setVisitor(null);
    setToken(null);
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="white" />
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center px-8">
        <Text className="text-white text-center text-base mb-6">
          Camera access is required to scan visitor QR codes.
        </Text>
        <TouchableOpacity
          className="bg-white rounded-2xl px-6 py-3"
          onPress={() =>
            Camera.requestCameraPermissionsAsync().then(({ status }) =>
              setHasPermission(status === 'granted'),
            )
          }
        >
          <Text className="text-gray-900 font-semibold">Grant Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (visitor) {
    const pendingApproval = visitor.approvalStatus === 'PENDING';
    const rejected = visitor.approvalStatus === 'REJECTED';
    const busy = approve.isPending || reject.isPending || decision.isPending;

    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
        <AppHeader
          title="Visitor Details"
          subtitle={pendingApproval ? 'Approve before allowing entry.' : 'Verify before allowing entry.'}
          onBack={() => router.back()}
        />
        <View className="flex-1 px-6 pt-6">
          <Card padding="lg" className="rounded-3xl">
            <Text className="text-xs text-gray-400 dark:text-gray-500">NAME</Text>
            <Text className="text-2xl font-heading text-gray-900 dark:text-gray-100 mb-4">{visitor.name}</Text>

            <DetailRow label="Flat" value={flatLabel(visitor)} />
            {visitor.purpose && <DetailRow label="Purpose" value={visitor.purpose} />}
            {visitor.validUntil && (
              <DetailRow
                label="Expires"
                value={new Date(visitor.validUntil).toLocaleString('en-IN')}
              />
            )}
            {visitor.status && <DetailRow label="Visit status" value={visitor.status} />}
            {visitor.approvalStatus && (
              <DetailRow label="Approval" value={visitor.approvalStatus} />
            )}
          </Card>

          {pendingApproval ? (
            <View className="flex-row gap-3 mt-8">
              <TouchableOpacity
                className="flex-1 bg-red-500 rounded-2xl py-4 items-center"
                onPress={() => reject.mutate(visitor.id)}
                disabled={busy}
              >
                {reject.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Reject</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-amber-500 rounded-2xl py-4 items-center"
                onPress={() => approve.mutate(visitor.id)}
                disabled={busy}
              >
                {approve.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : rejected ? (
            <View className="mt-8 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4">
              <Text className="text-red-700 dark:text-red-200 text-center text-sm">
                This visitor was rejected and cannot enter.
              </Text>
            </View>
          ) : (
            <View className="flex-row gap-3 mt-8">
              <TouchableOpacity
                className="flex-1 bg-red-500 rounded-2xl py-4 items-center"
                onPress={() => decision.mutate({ allow: false })}
                disabled={busy}
              >
                {decision.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Deny</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-green-500 rounded-2xl py-4 items-center"
                onPress={() => decision.mutate({ allow: true })}
                disabled={busy}
              >
                {decision.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Allow Entry</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity className="mt-6 self-center" onPress={resetScan}>
            <Text className="text-gray-500 dark:text-gray-400 text-sm">Scan another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <SafeAreaView className="flex-1">
          {/* Camera viewfinder stays dark by design — only the back idiom is unified. */}
          <View className="flex-row items-center px-5 pt-4 mb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white font-heading text-base flex-1 text-center mr-10">
              Scan Visitor QR
            </Text>
          </View>

          <View className="flex-1 items-center justify-center">
            <View style={{ width: 240, height: 240 }}>
              {[
                { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
                { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
                { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
                { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
              ].map((style, i) => (
                <View
                  key={i}
                  style={[
                    {
                      position: 'absolute',
                      width: 40,
                      height: 40,
                      borderColor: 'white',
                      borderRadius: 4,
                    },
                    style as any,
                  ]}
                />
              ))}
            </View>

            {lookup.isPending && (
              <View className="mt-6 bg-black/60 rounded-2xl px-6 py-3">
                <ActivityIndicator color="white" />
                <Text className="text-white text-sm mt-2 text-center">Verifying…</Text>
              </View>
            )}
          </View>

          <View className="pb-12 items-center">
            <Text className="text-white/60 text-sm">Hold camera steady over the QR code</Text>
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-t border-gray-100 dark:border-gray-800">
      <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</Text>
    </View>
  );
}
