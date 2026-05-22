import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Vibration, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
// Socket type is `any` here because pnpm symlink + preserveSymlinks confuses
// the lookup of socket.io-client's nested type imports. Runtime is fine.
import { io } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
type Socket = any;
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { useTheme } from '../../src/hooks/useTheme';
import { useAccessibilityStore } from '../../src/store/accessibility.store';
import { ThemedButton } from '../../src/components/ui/ThemedButton';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    socket = io(API_BASE, {
      transports: ['websocket'],
      autoConnect: false,
    } as any);
  }
  return socket;
}

export default function SosScreen() {
  const [phase, setPhase] = useState<'confirm' | 'active'>('confirm');
  const [alertId, setAlertId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');
  const [noteSending, setNoteSending] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const sendingSosRef = useRef(false);

  // pulse ring for active phase
  const ring = useSharedValue(1);
  // ambient glow pulse
  const glowOpacity = useSharedValue(0.18);

  const t = useTheme();
  const seniorMode = useAccessibilityStore((s) => s.seniorMode);

  // SOS button dimensions scale with mode
  const sosCircle = seniorMode ? 240 : 200;
  const sosRadius = sosCircle / 2;
  const ringSize = sosCircle + 60;

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring.value }],
    opacity: 2 - ring.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  useEffect(() => {
    // Subtle ambient red glow pulsing on the background
    glowOpacity.value = withRepeat(
      withTiming(0.32, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const cancelDuringConfirm = () => {
    Vibration.cancel();
    router.back();
  };

  const triggerSos = async () => {
    if (sendingSosRef.current) return;
    sendingSosRef.current = true;
    setSosSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Vibration.vibrate([0, 200, 100, 200]);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | undefined;
      let lng: number | undefined;

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const raw = await api.post<object>('/sos/trigger', { lat, lng });
      const alert = unwrapApiEnvelope<{ id: string }>(raw);
      setAlertId(alert.id);
      setFollowUpNote('');
      setPhase('active');
      ring.value = withRepeat(
        withTiming(1.6, { duration: 1000, easing: Easing.out(Easing.ease) }),
        -1,
        true,
      );
    } catch {
      Alert.alert('Error', 'Could not send SOS. Please call security directly.');
    } finally {
      sendingSosRef.current = false;
      setSosSubmitting(false);
    }
  };

  const sendFollowUpNote = async () => {
    const id = alertId;
    const text = followUpNote.trim();
    if (!id || !text || noteSending) return;
    setNoteSending(true);
    try {
      await api.patch(`/sos/${id}/note`, { note: text });
      setFollowUpNote('');
      Alert.alert('Update sent', 'Security can see your message.');
    } catch {
      Alert.alert('Note not sent', 'Your SOS is still active. Try again.');
    } finally {
      setNoteSending(false);
    }
  };

  const resolveSos = async () => {
    if (!alertId) {
      router.back();
      return;
    }
    try {
      await api.patch(`/sos/${alertId}/false-alarm`, {});
    } finally {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      Vibration.cancel();
      router.back();
    }
  };

  useEffect(() => {
    return () => {
      Vibration.cancel();
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  useEffect(() => {
    if (phase === 'active' && alertId) {
      const s = getSocket();
      const token = useAuthStore.getState().token;
      if (token) {
        s.auth = { token };
        s.connect();
        s.on(`sos:${alertId}:acknowledged`, () => {
          setAcknowledged(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });
      }
      return () => {
        s.off(`sos:${alertId}:acknowledged`);
      };
    }
  }, [phase, alertId]);

  // --- Confirm phase ---
  if (phase === 'confirm') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bgPrimary }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0, bottom: 0, left: 0, right: 0,
              backgroundColor: t.accentEmergency,
            },
            glowStyle,
          ]}
        />

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.screenPadding }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 40, width: ringSize, height: ringSize }}>
            <View style={{
              position: 'absolute',
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              backgroundColor: `${t.accentEmergency}22`,
              borderWidth: 1,
              borderColor: `${t.accentEmergency}44`,
            }} />

            <TouchableOpacity
              onPress={triggerSos}
              disabled={sosSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Emergency SOS. Sends alert immediately with your location."
              style={{
                width: sosCircle,
                height: sosCircle,
                borderRadius: sosRadius,
                backgroundColor: t.accentEmergency,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: t.glowEmergency,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 1,
                shadowRadius: 32,
                elevation: 20,
              }}
            >
              {sosSubmitting ? (
                <Text style={{ fontSize: t.font4xl, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2 }}>…</Text>
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="warning" size={64} color="#FFFFFF" />
                  <Text style={{ fontSize: t.fontXl, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2, marginTop: 4 }}>SOS</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <Text style={{
            color: '#FFFFFF',
            fontSize: t.font2xl,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 10,
          }}>
            Medical Emergency?
          </Text>
          <Text style={{
            color: 'rgba(255,200,200,0.9)',
            fontSize: t.fontBase,
            lineHeight: t.fontBase * t.lineHeightRelaxed,
            textAlign: 'center',
            marginBottom: 40,
            paddingHorizontal: 8,
          }}>
            Tap SOS to alert security immediately. Your location is shared when you allow it. You can add a note on the next screen.
          </Text>

          <View style={{ width: '100%', gap: 12 }}>
            <ThemedButton
              label={sosSubmitting ? 'Sending…' : 'Yes, Send SOS Now'}
              onPress={triggerSos}
              variant="danger"
              size="lg"
              disabled={sosSubmitting}
              accessibilityLabel="Emergency SOS. Sends alert and location now."
            />
            <ThemedButton
              label="Cancel"
              onPress={cancelDuringConfirm}
              variant="ghost"
              size="md"
              accessibilityLabel="Cancel - go back without sending SOS"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- Active phase ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgPrimary }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            inset: 0,
            backgroundColor: t.accentEmergency,
          },
          glowStyle,
        ]}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: t.screenPadding,
            paddingVertical: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
        {/* Pulsing ring + circle */}
        <View style={{
          alignItems: 'center',
          justifyContent: 'center',
          width: ringSize,
          height: ringSize,
          marginBottom: 32,
        }}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                backgroundColor: `${t.accentEmergency}55`,
              },
              ringStyle,
            ]}
          />
          <View style={{
            width: sosCircle,
            height: sosCircle,
            borderRadius: sosRadius,
            backgroundColor: t.accentEmergency,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: t.glowEmergency,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 1,
            shadowRadius: 32,
            elevation: 20,
          }}>
            <Ionicons name="warning" size={64} color="#FFFFFF" />
            <Text style={{ fontSize: t.fontXl, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2, marginTop: 4 }}>
              SOS
            </Text>
          </View>
        </View>

        <Text style={{
          color: '#FFFFFF',
          fontSize: t.font2xl,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 8,
        }}>
          Alert Sent!
        </Text>
        <Text style={{
          color: 'rgba(255,200,200,0.9)',
          fontSize: t.fontBase,
          lineHeight: t.fontBase * t.lineHeightRelaxed,
          textAlign: 'center',
          marginBottom: 20,
          paddingHorizontal: 8,
        }}>
          Security and medical staff have been alerted. Stay calm and wait for assistance.
        </Text>

        {acknowledged && (
          <View style={{
            backgroundColor: 'rgba(74,222,128,0.2)',
            borderRadius: t.radiusMd,
            borderWidth: 1,
            borderColor: 'rgba(74,222,128,0.5)',
            paddingHorizontal: 20,
            paddingVertical: 12,
            marginBottom: 20,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <Ionicons name="checkmark-circle" size={20} color={t.accentSuccess} />
            <Text style={{ color: '#FFFFFF', fontSize: t.fontBase, fontWeight: '600' }}>
              Help is on the way!
            </Text>
          </View>
        )}

        {/* Info strip */}
        <View style={{
          backgroundColor: 'rgba(255,59,48,0.2)',
          borderRadius: t.radiusMd,
          borderWidth: 1,
          borderColor: 'rgba(255,59,48,0.35)',
          paddingHorizontal: 16,
          paddingVertical: 12,
          marginBottom: 32,
          width: '100%',
        }}>
          <Text style={{ color: 'rgba(255,200,200,0.9)', fontSize: t.fontSm, textAlign: 'center' }}>
            Your location has been shared
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: t.fontSm, fontWeight: '600', textAlign: 'center', marginTop: 4 }}>
            Emergency: Call 112 if no response in 3 minutes
          </Text>
        </View>

        <Text style={{
          alignSelf: 'stretch',
          color: 'rgba(255,220,220,0.95)',
          fontSize: t.fontSm,
          fontWeight: '600',
          marginBottom: 8,
        }}>
          Add details for security (optional)
        </Text>
        <TextInput
          value={followUpNote}
          onChangeText={setFollowUpNote}
          placeholder="e.g. symptoms, flat, who needs help"
          placeholderTextColor="rgba(255,200,200,0.55)"
          maxLength={2000}
          multiline
          textAlignVertical="top"
          editable={!noteSending}
          style={{
            alignSelf: 'stretch',
            minHeight: 80,
            marginBottom: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: 'rgba(0,0,0,0.22)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            color: '#FFFFFF',
            fontSize: t.fontBase,
          }}
        />
        <View style={{ width: '100%', gap: 12, marginBottom: 8 }}>
        <ThemedButton
          label={noteSending ? 'Sending…' : 'Send note to security'}
          onPress={sendFollowUpNote}
          variant="danger"
          size="md"
          disabled={followUpNote.trim().length === 0}
          loading={noteSending}
          accessibilityLabel="Send optional note to security"
        />

        <ThemedButton
          label="I'm OK — Cancel Alert"
          onPress={resolveSos}
          variant="ghost"
          size="lg"
          accessibilityLabel="I'm OK - Cancel alert, I am safe"
        />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
