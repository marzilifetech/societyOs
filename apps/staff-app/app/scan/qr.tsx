import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView } from 'expo-camera';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../src/lib/api';

type Visitor = {
  id?: string;
  visitorName: string;
  unitNo?: string;
  flatNumber?: string;
  visitPurpose?: string;
  expiresAt?: string;
  status?: string;
};

export default function QrScanScreen() {
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

  // Visitor decision screen after a successful scan + lookup.
  if (visitor) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 px-6 pt-12">
          <Text className="text-white text-2xl font-bold mb-1">Visitor Details</Text>
          <Text className="text-gray-400 text-sm mb-8">Verify before allowing entry.</Text>

          <View className="bg-white rounded-3xl p-6 shadow-lg">
            <Text className="text-xs text-gray-400">NAME</Text>
            <Text className="text-2xl font-bold text-gray-900 mb-4">{visitor.visitorName}</Text>

            <DetailRow label="Flat" value={visitor.flatNumber ?? visitor.unitNo ?? '—'} />
            {visitor.visitPurpose && <DetailRow label="Purpose" value={visitor.visitPurpose} />}
            {visitor.expiresAt && (
              <DetailRow
                label="Expires"
                value={new Date(visitor.expiresAt).toLocaleString('en-IN')}
              />
            )}
            {visitor.status && <DetailRow label="Status" value={visitor.status} />}
          </View>

          <View className="flex-row gap-3 mt-8">
            <TouchableOpacity
              className="flex-1 bg-red-500 rounded-2xl py-4 items-center"
              onPress={() => decision.mutate({ allow: false })}
              disabled={decision.isPending}
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
              disabled={decision.isPending}
            >
              {decision.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">Allow Entry</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="mt-6 self-center"
            onPress={() => {
              setScanned(false);
              setVisitor(null);
              setToken(null);
            }}
          >
            <Text className="text-gray-400 text-sm">Scan another</Text>
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
          <View className="flex-row items-center px-6 pt-4 mb-8">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-white text-base">← Back</Text>
            </TouchableOpacity>
            <Text className="text-white font-semibold text-base flex-1 text-center mr-12">
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
    <View className="flex-row justify-between py-2 border-t border-gray-100">
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900">{value}</Text>
    </View>
  );
}
