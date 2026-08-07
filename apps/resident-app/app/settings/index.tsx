import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, Alert, StyleSheet, Linking } from 'react-native';
import { Tappable } from '../../src/components/ui/Tappable';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../src/store/auth.store';
import { APP_NAME, APP_VERSION_LABEL } from '../../src/lib/app-version';
import { Display, rd } from '../../src/components/ui/redesign';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Item = {
  icon: IoniconName;
  label: string;
  route: string;
  tint: string;
  description?: string;
};

type Section = { title: string; items: Item[] };

/**
 * Settings is the resident's single map of "everything about me and my home".
 * Previously it listed only four preference rows, so account-level destinations
 * (family, vehicles, property, documents, wallet, help) were reachable only by
 * remembering an unrelated entry point — several were effectively unreachable.
 * Grouping them here mirrors iOS/Android platform settings conventions:
 * short, labelled sections instead of one long undifferentiated list.
 */
const SECTIONS: Section[] = [
  {
    title: 'Account',
    items: [
      {
        icon: 'person-outline',
        label: 'Personal details',
        route: '/profile/edit',
        tint: '#821A52',
        description: 'Your name and email',
      },
      {
        icon: 'people-outline',
        label: 'Family members',
        route: '/family',
        tint: '#0EA5E9',
        description: 'People living with you',
      },
      {
        icon: 'car-outline',
        label: 'Vehicles',
        route: '/vehicles',
        tint: '#7C3AED',
        description: 'Cars and bikes registered to your flat',
      },
      {
        icon: 'home-outline',
        label: 'My property',
        route: '/property',
        tint: '#16A34A',
        description: 'Flat details and ownership',
      },
      {
        icon: 'construct-outline',
        label: 'Domestic help',
        route: '/domestic-help',
        tint: '#D97706',
        description: 'Maids, cooks and drivers',
      },
      {
        icon: 'document-text-outline',
        label: 'Documents',
        route: '/documents',
        tint: '#0284C7',
        description: 'KYC and society paperwork',
      },
    ],
  },
  {
    title: 'Preferences',
    items: [
      {
        icon: 'notifications-outline',
        label: 'Notifications',
        route: '/settings/notifications',
        tint: '#0EA5E9',
        description: 'Choose what you get alerted about',
      },
      {
        icon: 'eye-outline',
        label: 'Accessibility',
        route: '/settings/accessibility',
        tint: '#7C3AED',
        description: 'Larger text and higher contrast',
      },
      {
        icon: 'language-outline',
        label: 'Language',
        route: '/settings/language',
        tint: '#16A34A',
        description: 'Change the app language',
      },
    ],
  },
  {
    title: 'Payments',
    items: [
      {
        icon: 'wallet-outline',
        label: 'Wallet',
        route: '/wallet',
        tint: '#16A34A',
        description: 'Balance and transaction history',
      },
      {
        icon: 'card-outline',
        label: 'Maintenance & dues',
        route: '/maintenance',
        tint: '#0EA5E9',
        description: 'Bills and payment history',
      },
      {
        icon: 'repeat-outline',
        label: 'Subscriptions',
        route: '/subscriptions',
        tint: '#D97706',
        description: 'Recurring services you have joined',
      },
    ],
  },
  {
    title: 'Help & support',
    items: [
      {
        icon: 'chatbubble-ellipses-outline',
        label: 'Send feedback',
        route: '/feedback',
        tint: '#7C3AED',
        description: 'Tell us what could be better',
      },
      {
        icon: 'medkit-outline',
        label: 'Notifications not arriving?',
        route: '/profile/notification-troubleshoot',
        tint: '#B45309',
        description: 'Step-by-step fixes for missing alerts',
      },
      {
        icon: 'flask-outline',
        label: 'Send a test notification',
        route: '/settings/notification-test',
        tint: '#F59E0B',
        description: 'Check alerts work on this phone',
      },
    ],
  },
];

const SUPPORT_EMAIL = 'support@marzitech.in';

export default function SettingsScreen() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  const initials = useMemo(() => {
    const name = user?.name?.trim();
    if (!name) return null;
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || null;
  }, [user?.name]);

  const go = (route: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(route as any);
  };

  const handleLogout = () => {
    Alert.alert('Sign out', `You will need your phone number to sign back in to ${APP_NAME}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/society-select');
        },
      },
    ]);
  };

  /**
   * There is no self-serve deletion endpoint on the backend yet, so this opens
   * a pre-filled support request rather than pretending to delete on the spot.
   * Play policy requires a discoverable in-app route to account deletion; an
   * assisted flow satisfies that as long as we don't imply it is instant.
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This removes your profile, family members, vehicles and documents from your society. ' +
        'Our support team completes the deletion within 7 days and will confirm by email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request deletion',
          style: 'destructive',
          onPress: () => {
            const subject = encodeURIComponent('Account deletion request');
            const body = encodeURIComponent(
              `Please delete my ${APP_NAME} account.\n\n` +
                `Registered phone: ${user?.phone ?? '(add your number)'}\n` +
                `Name: ${user?.name ?? '(add your name)'}\n`,
            );
            Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(
              () => {
                Alert.alert(
                  'No email app found',
                  `Please email ${SUPPORT_EMAIL} from any device to request deletion.`,
                );
              },
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#141414" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Display size="lg">Settings</Display>
        </View>

        {/* Identity card — confirms which account these settings belong to. */}
        <Pressable
          onPress={() => go('/profile/edit')}
          style={styles.identityCard}
          accessibilityRole="button"
          accessibilityLabel="Edit your personal details"
        >
          <View style={styles.avatar}>
            {initials ? (
              <Text style={styles.avatarText}>{initials}</Text>
            ) : (
              <Ionicons name="person" size={22} color="#821A52" />
            )}
          </View>
          <View style={styles.identityBody}>
            <Text style={styles.identityName} numberOfLines={1}>
              {user?.name?.trim() || 'Your profile'}
            </Text>
            {user?.phone ? (
              <Text style={styles.identitySub} numberOfLines={1}>
                {user.phone}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <Pressable
                  key={item.route}
                  onPress={() => go(item.route)}
                  style={[
                    styles.row,
                    i < section.items.length - 1 && styles.rowDivider,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityHint={item.description}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${item.tint}1A` }]}>
                    <Ionicons name={item.icon} size={18} color={item.tint} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    {item.description ? (
                      <Text style={styles.rowDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account actions</Text>
          <View style={styles.card}>
            <Tappable
              onPress={handleLogout}
              style={[styles.row, styles.rowDivider]} pressedStyle={styles.rowPressed}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(107,114,128,0.12)' }]}>
                <Ionicons name="log-out-outline" size={18} color="#4B5563" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Sign out</Text>
                <Text style={styles.rowDesc}>Sign back in anytime with your phone number</Text>
              </View>
            </Tappable>
            <Tappable
              onPress={handleDeleteAccount}
              style={styles.row} pressedStyle={styles.rowPressed}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(196,40,71,0.12)' }]}>
                <Ionicons name="trash-outline" size={18} color={rd.crimson} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: rd.crimson }]}>Delete account</Text>
                <Text style={styles.rowDesc}>Permanently remove your data from this society</Text>
              </View>
            </Tappable>
          </View>
        </View>

        <Text
          style={styles.version}
          accessibilityLabel={`${APP_NAME}, version ${APP_VERSION_LABEL}`}
        >
          {APP_NAME} · {APP_VERSION_LABEL}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: rd.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingBottom: 48 },
  headerBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: rd.radiusCardLg,
    borderWidth: 1,
    borderColor: rd.cardBorder,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(130,26,82,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: '#821A52' },
  identityBody: { flex: 1 },
  identityName: { fontSize: 16, fontWeight: '700', color: '#141414' },
  identitySub: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  section: { marginTop: 22 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: rd.radiusCardLg,
    borderWidth: 1,
    borderColor: rd.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 64,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  rowPressed: { backgroundColor: '#F4F4F6' },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#141414' },
  rowDesc: { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 16 },

  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 28 },
});
