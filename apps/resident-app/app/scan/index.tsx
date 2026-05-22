import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView } from 'expo-camera';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';

type VisitorPass = {
  id: string;
  name: string;
  purpose?: string;
  status: string;
  validUntil?: string;
  flat?: { number: string; block?: string };
};

export default function ScanScreen() {
  const t = useTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<VisitorPass | null>(null);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) =>
      setHasPermission(status === 'granted'),
    );
  }, []);

  const lookup = useMutation({
    mutationFn: (token: string) => api.get<VisitorPass>(`/visitors/qr/${token}`),
    onSuccess: (data: VisitorPass) => {
      setResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Not found', err?.message ?? 'Could not look up this QR code.', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
    },
  });

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanned || lookup.isPending) return;
    setScanned(true);
    lookup.mutate(data);
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#821A52" />
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-5">
          <Ionicons name="camera-outline" size={40} color="#821A52" />
        </View>
        <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">Camera access required</Text>
        <Text className="text-gray-500 text-base text-center mb-6" style={{ lineHeight: t.fontBase * t.lineHeight }}>
          Camera access is needed to scan QR codes.
        </Text>
        <TouchableOpacity
          className="bg-primary-500 rounded-xl px-6 flex-row items-center gap-2"
          style={{ minHeight: t.touchTarget, justifyContent: 'center' }}
          onPress={() =>
            Camera.requestCameraPermissionsAsync().then(({ status }) =>
              setHasPermission(status === 'granted'),
            )
          }
        >
          <Ionicons name="camera-outline" size={18} color="#fff" />
          <Text className="text-white font-semibold text-base">Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="mt-4 flex-row items-center gap-1"
          style={{ minHeight: t.touchTargetSm, justifyContent: 'center' }}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={16} color="#9CA3AF" />
          <Text className="text-gray-500 text-sm">Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (result) {
    const statusStyle: Record<string, { bg: string; text: string }> = {
      EXPECTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
      CHECKED_IN: { bg: 'bg-green-100', text: 'text-green-700' },
      CHECKED_OUT: { bg: 'bg-gray-100', text: 'text-gray-700' },
      DENIED: { bg: 'bg-red-100', text: 'text-red-700' },
    };
    const s = statusStyle[result.status] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 px-6 pt-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="self-start flex-row items-center gap-1 -ml-2 p-2 mb-4"
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
            <Text className="text-gray-900 text-base">Back</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-3 mb-1">
            <View className="w-12 h-12 rounded-xl bg-primary-50 items-center justify-center">
              <Ionicons name="checkmark-circle" size={26} color="#821A52" />
            </View>
            <View>
              <Text className="text-gray-900 text-2xl font-bold">Visitor Pass</Text>
              <Text className="text-gray-500 text-sm">Scanned successfully</Text>
            </View>
          </View>

          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 gap-3.5 mt-5">
            <Row label="Name" value={result.name} />
            {result.purpose ? <Row label="Purpose" value={result.purpose} /> : null}
            {result.flat ? (
              <Row
                label="Flat"
                value={[result.flat.block, result.flat.number].filter(Boolean).join('-')}
              />
            ) : null}
            {result.validUntil ? (
              <Row
                label="Valid Until"
                value={new Date(result.validUntil).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              />
            ) : null}
            <View className="flex-row justify-between items-center pt-3 border-t border-gray-200">
              <Text className="text-gray-500 text-sm">Status</Text>
              <View className={`rounded-full px-3 py-1 ${s.bg}`}>
                <Text className={`text-sm font-semibold ${s.text}`}>
                  {result.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            className="mt-7 bg-primary-500 rounded-xl items-center flex-row justify-center gap-2"
            style={{ minHeight: t.touchTarget, justifyContent: 'center' }}
            onPress={() => { setScanned(false); setResult(null); }}
          >
            <Ionicons name="scan" size={18} color="#fff" />
            <Text className="text-white font-semibold text-base">Scan Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* Header */}
          <View className="flex-row items-center px-6 pt-2 pb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ minHeight: t.touchTarget, minWidth: t.touchTarget, justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1 flex-row items-center justify-center gap-2" style={{ marginRight: t.touchTarget }}>
              <Ionicons name="qr-code" size={18} color="#fff" />
              <Text className="text-white font-semibold text-base">Scan QR Code</Text>
            </View>
          </View>

          {/* Viewfinder */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 240, height: 240, position: 'relative' }}>
              {/* Corner brackets */}
              {[
                { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
                { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
                { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
                { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
              ].map((s, i) => (
                <View
                  key={i}
                  style={[{ position: 'absolute', width: 44, height: 44, borderColor: '#fff', borderRadius: 4 }, s as any]}
                />
              ))}

              {lookup.isPending && (
                <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8 }}>
                  <ActivityIndicator color="white" />
                  <Text style={{ color: '#fff', fontSize: 13, marginTop: 8 }}>Verifying…</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ paddingBottom: 48, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: t.fontSm }}>
              Hold steady over a visitor gate pass
            </Text>
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className="text-gray-900 text-sm font-semibold flex-1 text-right">{value}</Text>
    </View>
  );
}
