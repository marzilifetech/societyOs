import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tappable } from './ui/Tappable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { AppUpdateBanner } from './AppUpdateBanner';

const BRAND = colors.primary[500];

/**
 * Top-level update wrapper for the staff app. Same contract as the
 * resident-app gate; only the brand color and update message tone differ
 * (staff users are trained, so we lean technical: "Update Required" rather
 * than the friendlier resident-facing copy).
 */
export function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const policy = useAppUpdate('staff');

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
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-download" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.body}>
          {message ??
            'A newer version of SocietyOS Staff is needed to continue. Please update.'}
        </Text>
        <Tappable
          onPress={onUpdate}
          accessibilityRole="button"
          accessibilityLabel="Update SocietyOS Staff now"
          style={styles.button}
          pressedStyle={{ opacity: 0.85 }}
        >
          <Text style={styles.buttonText}>Update Now</Text>
        </Tappable>
        <Text style={styles.footer}>The app is locked until you update.</Text>
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
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: '#475569',
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
    color: '#94A3B8',
    textAlign: 'center',
  },
});
