import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tappable } from './ui/Tappable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { AppUpdateBanner } from './AppUpdateBanner';
import { APP_NAME } from '../lib/app-version';

const BRAND = '#821A52';

/**
 * Top-level update wrapper. Renders one of three things in order:
 *
 *   1. Children only — `level === 'none'`. Nothing to nag about.
 *   2. Children + a dismissible banner at the top — `level === 'flexible'`.
 *   3. A full-screen blocker that REPLACES children — `level === 'immediate'`.
 *
 * The blocker has a single, very large CTA. No "Skip" button. No back-handler
 * override (Android back still works system-wide — we just remount the same
 * screen every time the user navigates within the gate). This matches the
 * Google Play in-app-update IMMEDIATE mode UX so users who later install via
 * Play Store see consistent behavior.
 *
 * Mount once in app/_layout.tsx, wrapping the Stack.
 */
export function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const policy = useAppUpdate('resident');

  if (policy?.level === 'immediate') {
    return <ImmediateBlocker url={policy.updateUrl} message={policy.updateMessage} />;
  }

  return (
    <>
      {policy?.level === 'flexible' && (
        <AppUpdateBanner url={policy.updateUrl} message={policy.updateMessage} />
      )}
      {children}
    </>
  );
}

function ImmediateBlocker({ url, message }: { url: string; message: string | null }) {
  const onUpdate = () => {
    Linking.openURL(url).catch(() => {
      // Best-effort — if the URL is malformed or the device can't open it,
      // there's nothing the user can do from here. The next foreground will
      // re-fetch the policy; if it now says level=none the gate disappears.
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-download" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.body}>
          {message ??
            `A newer version of ${APP_NAME} is needed to keep your account safe. Please update to continue.`}
        </Text>
        <Tappable
          onPress={onUpdate}
          accessibilityRole="button"
          accessibilityLabel={`Update ${APP_NAME} now`}
          style={styles.button} pressedStyle={{ opacity: 0.85 }}
        >
          <Text style={styles.buttonText}>Update Now</Text>
        </Tappable>
        <Text style={styles.footer}>
          You won&apos;t be able to use the app until you update.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 360,
  },
  button: {
    backgroundColor: BRAND,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 14,
    minWidth: 220,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  footer: {
    marginTop: 20,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
