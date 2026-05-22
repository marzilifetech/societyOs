import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';

const FAQ: { q: string; a: string }[] = [
  { q: 'How do I check in for my shift?', a: 'Open the Attendance tab and tap Check In. You must be inside the society geofence; the app will use your phone GPS to verify.' },
  { q: 'What if I cannot check in due to location?', a: 'Walk closer to the society building, then retry. If the issue continues, ask your supervisor to log a manual attendance.' },
  { q: 'How do I apply for leave?', a: 'Go to Profile → Request Leave. Choose type, dates, and reason. Your supervisor will approve or reject.' },
  { q: 'How do I upload before/after photos for a task?', a: 'Open the task and tap Capture Photo. The app stamps GPS and time on every photo automatically.' },
  { q: 'What happens if I have no internet?', a: 'You can still view tasks and capture photos. Updates queue automatically and sync when you are back online.' },
  { q: 'How do I see my salary slip?', a: 'Profile → Salary Slips. Tap the month to view the PDF.' },
  { q: 'Can I change the app language?', a: 'Yes. Go to Settings → Language and pick from English, Hindi, Kannada, Tamil, or Marathi.' },
  { q: 'How do I enable biometric login?', a: 'Settings → Notifications & Security → Biometric Login. You will be asked to verify with your fingerprint or face once.' },
  { q: 'What is Data Saver mode?', a: 'When on, photos are compressed more, and images load only when you tap them. Useful on 2G/3G.' },
  { q: 'How do I contact support?', a: 'Email staff-support@societyos.app or call your society office. We respond within one business day.' },
];

export default function HelpScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">{t('settings.help')}</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-2">
        {FAQ.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => setExpanded(expanded === idx ? null : idx)}
            className="bg-white rounded-2xl p-4"
          >
            <View className="flex-row justify-between items-center">
              <Text className="flex-1 text-sm font-semibold text-gray-900 pr-2">{item.q}</Text>
              <Text className="text-gray-400 text-lg">{expanded === idx ? '−' : '+'}</Text>
            </View>
            {expanded === idx ? (
              <Text className="text-sm text-gray-600 mt-3 leading-relaxed">{item.a}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
