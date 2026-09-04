import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import { checkPermission, ensurePermission } from '../../src/lib/permissions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { AppHeader, Card } from '../../src/components/ui';
import { QrScanner, nativeScannerAvailable } from '../../src/components/QrScanner';

type Visitor = {
  id: string;
  name: string;
  purpose?: string;
  approvalStatus?: string;
  status?: string;
  validUntil?: string;
  resident?: { flat?: { number?: string; block?: string } };
};

/** What the guard is currently looking at. */
type Phase =
  | { kind: 'scanning' }
  | { kind: 'verifying' }
  | { kind: 'visitor'; visitor: Visitor }
  | { kind: 'error'; message: string }
  | { kind: 'done'; allowed: boolean; name: string };

function flatLabel(visitor: Visitor): string {
  const flat = visitor.resident?.flat;
  if (!flat) return '—';
  return [flat.block, flat.number].filter(Boolean).join('-') || '—';
}

export default function QrScanScreen() {
  const qc = useQueryClient();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });
  const [torch, setTorch] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Check on mount without prompting — the "Allow camera" button below owns
  // the ask, so the OS dialog appears on a deliberate tap rather than the
  // instant the screen opens.
  useEffect(() => {
    void checkPermission('camera').then((r) => setHasPermission(r.granted));
  }, []);

  /**
   * Ask for the camera, and take the user to settings if the refusal is
   * permanent. Re-requesting a blocked permission shows no dialog at all on
   * Android 13+, so the old "Allow camera" button became inert after the first
   * refusal — it looked broken rather than blocked.
   */
  const requestCamera = async () => {
    const r = await ensurePermission('camera', {
      blockedMessage: 'Scanning a gate pass needs the camera.',
    });
    setHasPermission(r.granted);
  };

  const invalidateVisitors = () => {
    qc.invalidateQueries({ queryKey: ['staff-visitors-pending'] });
    qc.invalidateQueries({ queryKey: ['staff-visitors-pending-count'] });
  };

  const reset = () => {
    setPhase({ kind: 'scanning' });
    setToken(null);
  };

  const lookup = useMutation({
    mutationFn: (qr: string) => api.get<Visitor>(`/visitors/qr/${qr}`),
    onSuccess: (data) => {
      setPhase({ kind: 'visitor', visitor: data });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: (err: any) => {
      setPhase({ kind: 'error', message: err?.message ?? 'This pass could not be read.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/staff/visitors/${id}/approve`, {}),
    onSuccess: (data) => {
      setPhase({ kind: 'visitor', visitor: data as Visitor });
      invalidateVisitors();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: (err: any) =>
      setPhase({ kind: 'error', message: err?.message ?? 'Could not approve. Try again.' }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/staff/visitors/${id}/reject`, {}),
    onSuccess: (_d, id) => {
      invalidateVisitors();
      const name = phase.kind === 'visitor' ? phase.visitor.name : 'Visitor';
      setPhase({ kind: 'done', allowed: false, name });
    },
    onError: (err: any) =>
      setPhase({ kind: 'error', message: err?.message ?? 'Could not reject. Try again.' }),
  });

  const decision = useMutation({
    mutationFn: ({ allow }: { allow: boolean }) =>
      api.post('/visitors/check-in', { qrToken: token, decision: allow ? 'ALLOW' : 'DENY' }),
    onSuccess: (_data, vars) => {
      const name = phase.kind === 'visitor' ? phase.visitor.name : 'Visitor';
      setPhase({ kind: 'done', allowed: vars.allow, name });
      invalidateVisitors();
      Haptics.notificationAsync(
        vars.allow
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    },
    onError: (err: any) =>
      setPhase({ kind: 'error', message: err?.message ?? 'Could not record entry. Try again.' }),
  });

  const handleScan = (data: string) => {
    // The scanner de-dupes, but a second DIFFERENT code arriving while a
    // lookup is in flight would still race — hold the phase as the guard.
    if (phase.kind !== 'scanning') return;
    setToken(data);
    setPhase({ kind: 'verifying' });
    Haptics.selectionAsync().catch(() => {});
    lookup.mutate(data);
  };

  /* ── permission states ────────────────────────────────────────────────── */

  if (hasPermission === null) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
        <AppHeader title="Scan gate pass" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/50 items-center justify-center mb-5">
            <Ionicons name="camera-outline" size={28} color="#821A52" />
          </View>
          <Text className="font-heading text-lg text-gray-900 dark:text-gray-100 text-center">
            Camera access needed
          </Text>
          <Text className="font-body text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
            The camera is only used to read visitor QR passes at the gate.
          </Text>
          <TouchableOpacity
            className="bg-primary-500 rounded-2xl px-7 py-3.5 mt-7"
            accessibilityRole="button"
            onPress={requestCamera}
          >
            <Text className="text-white font-heading">Allow camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── result states (camera released) ──────────────────────────────────── */

  if (phase.kind === 'done') {
    return <ResultScreen allowed={phase.allowed} name={phase.name} onNext={reset} />;
  }

  if (phase.kind === 'visitor' || phase.kind === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
        <AppHeader
          title={phase.kind === 'error' ? 'Pass not valid' : 'Visitor details'}
          subtitle={
            phase.kind === 'error'
              ? 'Ask the visitor to check with the resident'
              : phase.visitor.approvalStatus === 'PENDING'
                ? 'Approve before allowing entry'
                : 'Verify before allowing entry'
          }
          onBack={reset}
        />
        <ScrollView contentContainerClassName="p-5 pb-10">
          {phase.kind === 'error' ? (
            <>
              <Card padding="lg" className="items-center">
                <View className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 items-center justify-center mb-4">
                  <Ionicons name="close-circle" size={28} color="#DC2626" />
                </View>
                <Text className="font-heading text-base text-gray-900 dark:text-gray-100 text-center">
                  {phase.message}
                </Text>
              </Card>
              <TouchableOpacity
                className="bg-primary-500 rounded-2xl py-4 items-center mt-6"
                accessibilityRole="button"
                onPress={reset}
              >
                <Text className="text-white font-heading">Scan again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <VisitorDecision
              visitor={phase.visitor}
              busy={approve.isPending || reject.isPending || decision.isPending}
              approving={approve.isPending}
              rejecting={reject.isPending}
              deciding={decision.isPending}
              onApprove={() => approve.mutate(phase.visitor.id)}
              onReject={() => reject.mutate(phase.visitor.id)}
              onAllow={() => decision.mutate({ allow: true })}
              onDeny={() => decision.mutate({ allow: false })}
              onRescan={reset}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── live camera ──────────────────────────────────────────────────────── */

  const verifying = phase.kind === 'verifying';

  return (
    <View className="flex-1 bg-black">
      <QrScanner
        style={{ flex: 1 }}
        torch={torch}
        // Stop emitting while a lookup is in flight rather than unmounting the
        // camera — remounting costs ~400ms of black preview on re-entry.
        paused={verifying}
        onScan={handleScan}
      />

      {/* Overlay chrome. pointerEvents box-none so taps fall through to
          nothing except the actual buttons. */}
      {/* StyleSheet.absoluteFill, not `className="absolute inset-0"`: NativeWind
          does not translate `inset-0` on this version, so the overlay collapsed
          to its content height and the scan frame + hint bunched up against the
          top of the screen instead of centring over the preview. */}
      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View className="flex-row items-center px-5 pt-4" pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white font-heading text-base flex-1 text-center">
            Scan gate pass
          </Text>
          <TouchableOpacity
            onPress={() => setTorch((v) => !v)}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              torch ? 'bg-white' : 'bg-black/40'
            }`}
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Turn off flashlight' : 'Turn on flashlight'}
            accessibilityState={{ selected: torch }}
          >
            <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color={torch ? '#111827' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>

        <View className="flex-1 items-center justify-center" pointerEvents="none">
          <ScanFrame active={!verifying} />
          {verifying ? (
            <View className="mt-8 bg-black/70 rounded-2xl px-6 py-4 items-center">
              <ActivityIndicator color="white" />
              <Text className="text-white font-body text-sm mt-2">Checking pass…</Text>
            </View>
          ) : null}
        </View>

        <View className="pb-10 px-8" pointerEvents="none">
          <Text className="text-white/70 font-body text-sm text-center">
            Point the camera at the visitor&apos;s QR code
          </Text>
          {!nativeScannerAvailable ? null : (
            <Text className="text-white/35 font-body text-[11px] text-center mt-1">
              Fast scan enabled
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ────────────────────────────── pieces ────────────────────────────────── */

/** Four corner brackets — the standard "aim here" affordance. */
function ScanFrame({ active }: { active: boolean }) {
  const color = active ? '#FFFFFF' : 'rgba(255,255,255,0.35)';
  return (
    <View style={{ width: 250, height: 250 }}>
      {[
        { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
        { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
        { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
        {
          bottom: 0,
          right: 0,
          borderBottomWidth: 4,
          borderRightWidth: 4,
          borderBottomRightRadius: 16,
        },
      ].map((corner, i) => (
        <View
          key={i}
          style={[
            { position: 'absolute', width: 44, height: 44, borderColor: color },
            corner as any,
          ]}
        />
      ))}
    </View>
  );
}

function VisitorDecision({
  visitor,
  busy,
  approving,
  rejecting,
  deciding,
  onApprove,
  onReject,
  onAllow,
  onDeny,
  onRescan,
}: {
  visitor: Visitor;
  busy: boolean;
  approving: boolean;
  rejecting: boolean;
  deciding: boolean;
  onApprove: () => void;
  onReject: () => void;
  onAllow: () => void;
  onDeny: () => void;
  onRescan: () => void;
}) {
  const pendingApproval = visitor.approvalStatus === 'PENDING';
  const rejected = visitor.approvalStatus === 'REJECTED';

  return (
    <>
      <Card padding="lg">
        <Text className="font-body text-xs text-gray-400 dark:text-gray-500 uppercase">Visitor</Text>
        <Text className="font-heading text-2xl text-gray-900 dark:text-gray-100 mt-1 mb-4">
          {visitor.name}
        </Text>
        <DetailRow label="Flat" value={flatLabel(visitor)} />
        {visitor.purpose ? <DetailRow label="Purpose" value={visitor.purpose} /> : null}
        {visitor.validUntil ? (
          <DetailRow label="Expires" value={new Date(visitor.validUntil).toLocaleString('en-IN')} />
        ) : null}
        {visitor.status ? <DetailRow label="Visit status" value={visitor.status} /> : null}
        {visitor.approvalStatus ? (
          <DetailRow label="Approval" value={visitor.approvalStatus} />
        ) : null}
      </Card>

      {rejected ? (
        <View className="mt-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 flex-row items-center">
          <Ionicons name="close-circle" size={20} color="#DC2626" />
          <Text className="text-red-700 dark:text-red-200 font-body text-sm ml-3 flex-1">
            This visitor was rejected and cannot enter.
          </Text>
        </View>
      ) : (
        <View className="flex-row gap-3 mt-6">
          <ActionButton
            tone="danger"
            label={pendingApproval ? 'Reject' : 'Deny entry'}
            icon="close"
            loading={pendingApproval ? rejecting : deciding}
            disabled={busy}
            onPress={pendingApproval ? onReject : onDeny}
          />
          <ActionButton
            tone="success"
            label={pendingApproval ? 'Approve' : 'Allow entry'}
            icon="checkmark"
            loading={pendingApproval ? approving : deciding}
            disabled={busy}
            onPress={pendingApproval ? onApprove : onAllow}
          />
        </View>
      )}

      <TouchableOpacity className="mt-6 self-center py-2" onPress={onRescan} accessibilityRole="button">
        <Text className="text-gray-500 dark:text-gray-400 font-body text-sm">Scan another pass</Text>
      </TouchableOpacity>
    </>
  );
}

function ActionButton({
  tone,
  label,
  icon,
  loading,
  disabled,
  onPress,
}: {
  tone: 'danger' | 'success';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const bg = tone === 'danger' ? 'bg-red-500' : 'bg-green-600';
  return (
    <TouchableOpacity
      className={`flex-1 ${bg} rounded-2xl py-4 items-center justify-center flex-row ${
        disabled ? 'opacity-60' : ''
      }`}
      style={{ minHeight: 56 }}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Ionicons name={icon} size={18} color="#FFFFFF" />
          <Text className="text-white font-heading ml-2">{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/**
 * Full-screen outcome. Replaces the old `Alert.alert(...)` confirmations: at a
 * gate, in daylight, a colour-filled screen readable at arm's length is far
 * better feedback than a small modal, and it keeps the "scan next" action
 * under the guard's thumb.
 */
function ResultScreen({
  allowed,
  name,
  onNext,
}: {
  allowed: boolean;
  name: string;
  onNext: () => void;
}) {
  return (
    <SafeAreaView className={`flex-1 ${allowed ? 'bg-green-600' : 'bg-red-600'}`}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center mb-6">
          <Ionicons name={allowed ? 'checkmark' : 'close'} size={52} color="#FFFFFF" />
        </View>
        <Text className="font-heading text-3xl text-white text-center">
          {allowed ? 'Entry allowed' : 'Entry denied'}
        </Text>
        <Text className="font-body text-base text-white/85 text-center mt-2">{name}</Text>
      </View>
      <View className="px-6 pb-10 gap-3">
        <TouchableOpacity
          className="bg-white rounded-2xl py-4 items-center"
          onPress={onNext}
          accessibilityRole="button"
        >
          <Text className={`font-heading ${allowed ? 'text-green-700' : 'text-red-700'}`}>
            Scan next visitor
          </Text>
        </TouchableOpacity>
        <TouchableOpacity className="py-3 items-center" onPress={() => router.back()} accessibilityRole="button">
          <Text className="text-white/90 font-body">Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-2.5 border-t border-gray-100 dark:border-gray-800">
      <Text className="font-body text-xs text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="font-heading text-sm text-gray-900 dark:text-gray-100 flex-1 text-right ml-4">
        {value}
      </Text>
    </View>
  );
}
