import { View, Text, TouchableOpacity, ScrollView, Alert, Switch, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { useAccessibilityStore } from '../../src/store/accessibility.store';
import { useTheme } from '../../src/hooks/useTheme';
import { useNotificationPermission } from '../../src/hooks/useNotificationPermission';

type DocsStatus = 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED';
type MyDocs = {
  status: DocsStatus;
  aadhaarLast4: string | null;
  aadhaarUrl: string | null;
  panNumber: string | null;
  panUrl: string | null;
  idProofUrl: string | null;
  addressProofUrl: string | null;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

type MenuItem = { icon: IoniconName; label: string; route: string; tint: string };

/** Chip showing where the KYC documents stand in the admin review cycle. */
function DocStatusChip({ status }: { status: DocsStatus }) {
  const meta = (() => {
    switch (status) {
      case 'VERIFIED':
        return { label: 'Verified', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
      case 'REJECTED':
        return { label: 'Re-upload needed', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
      case 'UPLOADED':
        return { label: 'Under review', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      default:
        return { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    }
  })();
  return (
    <View className={`${meta.bg} ${meta.border} border rounded-full px-3 py-1`}>
      <Text className={`${meta.text} font-semibold text-xs`}>{meta.label}</Text>
    </View>
  );
}

/**
 * Single document row inside the My Documents card. Read-only thumbnail +
 * masked caption. Tap opens the full image in a viewer (no edit). When the
 * document is missing for whatever reason, renders a muted placeholder so
 * the layout doesn't shift.
 */
function DocRow({
  label,
  imageUrl,
  caption,
  t,
  showDivider,
}: {
  label: string;
  imageUrl: string | null;
  caption: string | null;
  t: any;
  showDivider?: boolean;
}) {
  const open = () => {
    if (!imageUrl) return;
    // Open the signed URL in the system image viewer — no edit affordance.
    Linking.openURL(imageUrl).catch(() => {
      /* swallow — the row still shows the thumbnail */
    });
  };
  return (
    <TouchableOpacity
      onPress={open}
      disabled={!imageUrl}
      accessibilityRole={imageUrl ? 'button' : 'text'}
      accessibilityLabel={imageUrl ? `View ${label}` : `${label} not uploaded`}
      className={`flex-row items-center ${showDivider ? 'border-t border-gray-200' : ''}`}
      style={{
        minHeight: t.touchTarget,
        paddingHorizontal: t.cardPadding,
        paddingVertical: t.cardPadding * 0.75,
      }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#FFFFFF' }}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            backgroundColor: '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="image-outline" size={20} color="#9CA3AF" />
        </View>
      )}
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={{ fontSize: t.fontBase }} className="text-gray-900 font-semibold">
          {label}
        </Text>
        <Text
          style={{ fontSize: t.fontSm }}
          className={imageUrl ? 'text-gray-500 font-mono' : 'text-gray-400'}
        >
          {imageUrl ? caption ?? 'Tap to view' : 'Not uploaded'}
        </Text>
      </View>
      {imageUrl ? <Ionicons name="eye-outline" size={t.iconSm} color="#821A52" /> : null}
    </TouchableOpacity>
  );
}

const MENU_ITEMS: MenuItem[] = [
  { icon: 'card', label: 'Maintenance & Dues', route: '/maintenance', tint: '#0EA5E9' },
  { icon: 'restaurant', label: 'Canteen Menu', route: '/canteen', tint: '#D97706' },
  { icon: 'sparkles', label: 'Events', route: '/events', tint: '#DB2777' },
  { icon: 'medkit', label: 'Medical Appointments', route: '/medical', tint: '#16A34A' },
  { icon: 'chatbubble-ellipses', label: 'Complaints & Support', route: '/complaints', tint: '#7C3AED' },
  // Always-on entry to the troubleshoot screen — even when permission is
  // granted users may need to tweak battery saver / DnD / lockscreen.
  { icon: 'notifications-outline', label: 'Notifications troubleshooting', route: '/profile/notification-troubleshoot', tint: '#B45309' },
  { icon: 'settings-outline', label: 'Settings', route: '/settings', tint: '#821A52' },
];

export default function ProfileScreen() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const seniorMode = useAccessibilityStore((s) => s.seniorMode);
  const setSeniorMode = useAccessibilityStore((s) => s.setSeniorMode);
  const t = useTheme();
  const qc = useQueryClient();
  const { status: notifPerm } = useNotificationPermission();
  // Show the banner only when we have a *definitive* not-granted answer —
  // skip "unknown" (initial render) and "undetermined" (first-ever, the
  // system will ask) so we don't flash a warning the user shouldn't see yet.
  const notificationsBlocked = notifPerm === 'denied';

  const { data: profile } = useQuery({
    queryKey: ['resident-profile'],
    queryFn: () => api.get<any>('/residents/me'),
  });

  // KYC documents — read-only on this screen. We tolerate the 404 case
  // (profile-setup completed but documents step skipped) so the section can
  // render the upload nudge instead of erroring.
  const { data: myDocs } = useQuery<MyDocs | null>({
    queryKey: ['my-documents'],
    queryFn: () => api.get<MyDocs>('/residents/documents/me').catch(() => null),
  });

  const directoryMutation = useMutation({
    mutationFn: (visible: boolean) =>
      api.patch('/residents/me/directory-visibility', { visible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resident-profile'] }),
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not update directory visibility.'),
  });

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/society-select');
        },
      },
    ]);
  };

  const name = profile?.user?.name ?? 'Resident';
  const phone = profile?.user?.phone ?? '';
  const flatNo = profile ? `Flat ${profile.flat.block}-${profile.flat.number}` : '';
  const residentType = profile?.type ?? '';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: t.sectionGap }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-bold text-gray-900" style={{ fontSize: t.font2xl }}>Profile</Text>
            {seniorMode && (
              <View className="bg-primary-50 border border-primary-500 rounded-full px-3 py-1">
                <Text className="text-primary-500 font-semibold" style={{ fontSize: t.fontXs }}>Larger Fonts</Text>
              </View>
            )}
          </View>

          {/* Notification permission banner — only when the OS has actively
              denied (not pristine state). Tapping opens the troubleshoot
              screen with step-by-step fixes (battery saver, lockscreen, DND). */}
          {notificationsBlocked ? (
            <TouchableOpacity
              onPress={() => router.push('/profile/notification-troubleshoot' as any)}
              accessibilityRole="button"
              accessibilityLabel="Notifications are turned off. Tap to fix."
              className="bg-amber-50 border border-amber-300 rounded-2xl mb-4 flex-row items-center"
              style={{ padding: t.cardPadding }}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{
                  width: t.iconXl,
                  height: t.iconXl,
                  backgroundColor: '#FFFFFF',
                  marginRight: 12,
                }}
              >
                <Ionicons name="notifications-off" size={t.iconMd} color="#B45309" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-900 font-bold" style={{ fontSize: t.fontBase }}>
                  Notifications are turned off
                </Text>
                <Text
                  className="text-amber-800 mt-0.5"
                  style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeightBase }}
                >
                  You won&apos;t hear about visitors, packages, or emergencies. Tap to fix.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={t.iconSm} color="#B45309" />
            </TouchableOpacity>
          ) : null}

          {/* Profile Card */}
          <TouchableOpacity
            className="bg-gray-50 border border-gray-200 rounded-2xl flex-row items-center"
            style={{ padding: t.cardPadding }}
            onPress={() => router.push('/profile/edit' as any)}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <View
              className="rounded-full bg-primary-50 items-center justify-center"
              style={{ width: t.iconXl + 16, height: t.iconXl + 16, marginRight: t.cardPadding * 0.75 }}
            >
              <Ionicons name="person-circle" size={t.iconXl + 8} color="#821A52" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold" style={{ fontSize: t.fontLg }}>{name}</Text>
              {phone ? <Text className="text-gray-500" style={{ fontSize: t.fontSm }}>{phone}</Text> : null}
              <Text className="text-gray-400 mt-0.5" style={{ fontSize: t.fontXs }}>
                {flatNo}{residentType ? ` · ${residentType}` : ''}
              </Text>
              <Text className="text-primary-500 font-semibold mt-1" style={{ fontSize: t.fontXs }}>Edit profile →</Text>
            </View>
            <Ionicons name="chevron-forward" size={t.iconSm} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* KYC Documents — read-only summary. Edit is intentionally NOT
            offered here: documents go through admin review (VERIFIED state)
            and re-uploading after that would re-trigger review, confusing
            elderly users. If they're not uploaded yet, the section nudges
            them to the upload screen instead of showing an edit button. */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: t.sectionGap }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold text-gray-900" style={{ fontSize: t.fontXl }}>
              My Documents
            </Text>
            {myDocs && (myDocs.aadhaarUrl || myDocs.panUrl || myDocs.addressProofUrl) ? (
              <DocStatusChip status={myDocs.status} />
            ) : null}
          </View>

          {!myDocs || (!myDocs.aadhaarUrl && !myDocs.panUrl && !myDocs.addressProofUrl) ? (
            // No documents uploaded — nudge card.
            <TouchableOpacity
              onPress={() => router.push('/(auth)/documents' as any)}
              accessibilityRole="button"
              accessibilityLabel="Upload your identity documents"
              className="bg-primary-50 border border-primary-500 rounded-2xl"
              style={{ padding: t.cardPadding }}
            >
              <View className="flex-row items-center">
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    width: t.iconXl,
                    height: t.iconXl,
                    backgroundColor: '#FFFFFF',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="document-text-outline" size={t.iconMd} color="#821A52" />
                </View>
                <View className="flex-1">
                  <Text className="text-primary-500 font-bold" style={{ fontSize: t.fontBase }}>
                    Upload KYC documents
                  </Text>
                  <Text className="text-gray-600 mt-0.5" style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeightBase }}>
                    Aadhaar, PAN, and address proof. Needed once for the society office.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={t.iconSm} color="#821A52" />
              </View>
            </TouchableOpacity>
          ) : (
            // Documents present — show read-only thumbnails + masked numbers.
            <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
              <DocRow
                label="Aadhaar"
                imageUrl={myDocs.aadhaarUrl}
                caption={
                  myDocs.aadhaarLast4
                    ? `XXXX-XXXX-${myDocs.aadhaarLast4}`
                    : myDocs.aadhaarUrl
                    ? 'Number not provided'
                    : null
                }
                t={t}
              />
              <DocRow
                label="PAN"
                imageUrl={myDocs.panUrl}
                caption={myDocs.panNumber ?? null}
                t={t}
                showDivider
              />
              <DocRow
                label="Address proof"
                imageUrl={myDocs.addressProofUrl}
                caption={null}
                t={t}
                showDivider
              />
              {myDocs.status === 'REJECTED' ? (
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/documents' as any)}
                  className="bg-red-50 border-t border-red-200 flex-row items-center"
                  style={{ minHeight: t.touchTarget, paddingHorizontal: t.cardPadding }}
                >
                  <Ionicons name="alert-circle" size={t.iconSm} color="#DC2626" />
                  <Text className="text-red-700 font-semibold ml-2" style={{ fontSize: t.fontSm }}>
                    Documents were rejected — tap to re-upload
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {/* Menu */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: t.sectionGap }}>
          <Text className="font-semibold text-gray-900 mb-4" style={{ fontSize: t.fontXl }}>Quick Links</Text>
          <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
            {MENU_ITEMS.map((item, idx) => (
              <TouchableOpacity
                key={item.route}
                className={`flex-row items-center ${idx < MENU_ITEMS.length - 1 ? 'border-b border-gray-200' : ''}`}
                style={{ minHeight: t.touchTarget, paddingHorizontal: t.cardPadding, paddingVertical: t.cardPadding * 0.75 }}
                onPress={() => router.push(item.route as any)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View
                  className="rounded-full items-center justify-center"
                  style={{ width: t.iconMd + 14, height: t.iconMd + 14, marginRight: 12, backgroundColor: `${item.tint}1A` }}
                >
                  <Ionicons name={item.icon} size={t.iconSm} color={item.tint} />
                </View>
                <Text style={{ fontSize: t.fontBase }} className="flex-1 text-gray-900">{item.label}</Text>
                <Ionicons name="chevron-forward" size={t.iconSm} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Accessibility */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: t.sectionGap }}>
          <Text className="font-semibold text-gray-900 mb-4" style={{ fontSize: t.fontXl }}>Accessibility</Text>
          <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
            <View
              className="flex-row items-center"
              style={{ minHeight: t.touchTarget, paddingHorizontal: t.cardPadding, paddingVertical: t.cardPadding * 0.75 }}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{ width: t.iconMd + 14, height: t.iconMd + 14, marginRight: 12, backgroundColor: '#821A521A' }}
              >
                <Ionicons name="eye-outline" size={t.iconSm} color="#821A52" />
              </View>
              <View className="flex-1 mr-3">
                <Text style={{ fontSize: t.fontBase }} className="text-gray-900 font-semibold">Larger Fonts</Text>
                <Text style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeightBase }} className="text-gray-500 mt-0.5">
                  Larger text, bigger buttons, higher contrast
                </Text>
              </View>
              <Switch
                value={seniorMode}
                onValueChange={setSeniorMode}
                trackColor={{ false: '#E5E7EB', true: '#821A52' }}
                thumbColor="#FFFFFF"
                accessibilityLabel={`Senior mode toggle. Currently ${seniorMode ? 'on' : 'off'}`}
                accessibilityRole="switch"
              />
            </View>
          </View>
        </View>

        {/* Privacy */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: t.sectionGap }}>
          <Text className="font-semibold text-gray-900 mb-4" style={{ fontSize: t.fontXl }}>Privacy</Text>
          <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
            <View
              className="flex-row items-center"
              style={{ minHeight: t.touchTarget, paddingHorizontal: t.cardPadding, paddingVertical: t.cardPadding * 0.75 }}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{ width: t.iconMd + 14, height: t.iconMd + 14, marginRight: 12, backgroundColor: '#821A521A' }}
              >
                <Ionicons name="shield-checkmark" size={t.iconSm} color="#821A52" />
              </View>
              <View className="flex-1 mr-3">
                <Text style={{ fontSize: t.fontBase }} className="text-gray-900 font-semibold">Show in society directory</Text>
                <Text style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeightBase }} className="text-gray-500 mt-0.5">
                  Allow other residents to find you
                </Text>
              </View>
              <Switch
                value={profile?.showInDirectory ?? false}
                onValueChange={(val) => directoryMutation.mutate(val)}
                disabled={directoryMutation.isPending}
                trackColor={{ false: '#E5E7EB', true: '#821A52' }}
                thumbColor="#FFFFFF"
                accessibilityLabel={`Directory visibility toggle. Currently ${profile?.showInDirectory ? 'on' : 'off'}`}
                accessibilityRole="switch"
              />
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: 32 }}>
          <TouchableOpacity
            className="bg-gray-50 border border-gray-200 rounded-2xl flex-row items-center justify-center gap-2"
            style={{ minHeight: t.touchTarget, paddingVertical: t.cardPadding * 0.875 }}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Sign out of your account"
          >
            <Ionicons name="log-out-outline" size={t.iconSm} color="#DC2626" />
            <Text style={{ fontSize: t.fontBase }} className="text-red-600 font-semibold">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
