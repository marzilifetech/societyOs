import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { api } from '../../src/lib/api';

/**
 * Emergency / SOS — moved out of the Home tab FAB (which is now "Add Entry")
 * into a dedicated screen reachable from Profile.
 *
 * Flow identical to the previous FAB:
 *   1. Big red button -> POST /sos/staff with current location (best-effort).
 *   2. After the alert is created, offer an optional follow-up note via
 *      PATCH /sos/:id/note. Skipping is fine; the alert already reached ops.
 *
 * Location permission is requested LAZILY — we never block the SOS itself
 * on the permission dialog. If the user denies, the alert still ships, just
 * without coordinates. Matches the previous FAB behaviour.
 */
export default function SosScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });

  const [sending, setSending] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const sendSos = async () => {
    if (sending) return;
    setSending(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch {
        // Continue without coordinates — the SOS itself must not fail on a
        // GPS hiccup.
      }
      const body: { lat?: number; lng?: number } = {};
      if (lat != null) body.lat = lat;
      if (lng != null) body.lng = lng;
      const raw = await api.post<object>('/sos/staff', body);
      const alert = unwrapApiEnvelope<{ id: string }>(raw);
      setAlertId(alert.id);
      setNote('');
      setNoteOpen(true);
    } catch {
      Alert.alert(t('home.alertSosFailTitle'), t('home.alertSosFailBody'));
    } finally {
      setSending(false);
    }
  };

  const sendNote = async () => {
    if (!alertId) return;
    const text = note.trim();
    if (!text) {
      closeNote();
      return;
    }
    setSavingNote(true);
    try {
      await api.patch(`/sos/${alertId}/note`, { note: text });
      Alert.alert(t('home.alertNoteSentTitle'), t('home.alertNoteSentBody'));
    } catch {
      Alert.alert(t('home.alertNoteFailTitle'), t('home.alertNoteFailBody'));
    } finally {
      setSavingNote(false);
      closeNote();
    }
  };

  const closeNote = () => {
    setNoteOpen(false);
    setAlertId(null);
    setNote('');
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back') ?? 'Back'}
        >
          <Ionicons name="chevron-back" size={24} color="#1E3A5F" />
        </TouchableOpacity>
        <Text className="ml-2 text-lg font-bold text-gray-900 dark:text-gray-100">
          {t('home.sosModalTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <View className="items-center mt-8">
          <View className="w-24 h-24 rounded-full bg-red-50 dark:bg-red-950/40 items-center justify-center mb-6">
            <Ionicons name="warning" size={48} color="#DC2626" />
          </View>
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center">
            {t('home.sosModalTitle')}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center max-w-[280px]">
            {t('home.sosModalBody')}
          </Text>
        </View>

        <View className="flex-1 items-center justify-center my-10">
          <TouchableOpacity
            onPress={sendSos}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t('home.sosModalTitle')}
            className="w-44 h-44 rounded-full bg-red-500 items-center justify-center shadow-2xl"
            style={{ opacity: sending ? 0.7 : 1 }}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <>
                <Ionicons name="alert" size={56} color="#fff" />
                <Text className="text-white font-bold text-2xl mt-1">SOS</Text>
              </>
            )}
          </TouchableOpacity>
          <Text className="text-xs text-gray-500 dark:text-gray-500 mt-6 text-center">
            Sends your location to the operations team.
          </Text>
        </View>
      </ScrollView>

      {/* Optional follow-up note */}
      {noteOpen && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="absolute inset-0"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white dark:bg-gray-900 rounded-t-3xl px-6 pt-6 pb-8 border-t border-gray-100 dark:border-gray-800">
              <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t('home.alertNoteSentTitle')}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {t('home.sosModalBody')}
              </Text>
              <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                {t('home.noteOptional')}
              </Text>
              <TextInput
                className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 min-h-[100px]"
                placeholder={t('home.sosNotePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={note}
                onChangeText={setNote}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <View className="flex-row gap-3 mt-5">
                <TouchableOpacity
                  className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-3 items-center"
                  onPress={closeNote}
                >
                  <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {t('home.skip')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary-500 dark:bg-primary-600 rounded-xl py-3 items-center"
                  onPress={sendNote}
                  disabled={savingNote || note.trim().length === 0}
                >
                  {savingNote ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      className={`text-sm font-semibold ${
                        note.trim().length === 0 ? 'text-gray-400' : 'text-white'
                      }`}
                    >
                      {t('home.sendNote')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
