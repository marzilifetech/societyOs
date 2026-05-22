import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const LANGUAGE_KEY = 'app_language';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
];

export default function LanguageScreen() {
  const [selected, setSelected] = useState<string>('en');
  const [initial, setInitial] = useState<string>('en');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
      const code = stored ?? 'en';
      setSelected(code);
      setInitial(code);
    });
  }, []);

  const save = async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, selected);
    if (selected !== initial) {
      Alert.alert('Language Saved', 'Restart the app to apply the new language.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Language</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 }}>
        <Text className="text-gray-500 text-sm mb-4">Pick your preferred language. Restart the app to apply.</Text>

        <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden mb-6">
          {LANGUAGES.map((lang, i) => {
            const active = selected === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => setSelected(lang.code)}
                className={`flex-row items-center px-4 py-4 ${i < LANGUAGES.length - 1 ? 'border-b border-gray-200' : ''}`}
                style={{ minHeight: 56 }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${lang.label}`}
              >
                <View className="flex-1">
                  <Text className="text-gray-900 text-base font-semibold">{lang.native}</Text>
                  <Text className="text-gray-500 text-xs">{lang.label}</Text>
                </View>
                {active && <Ionicons name="checkmark" size={20} color="#821A52" />}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={save}
          className="bg-primary-500 rounded-2xl py-4 items-center"
          style={{ minHeight: 56 }}
          accessibilityRole="button"
          accessibilityLabel="Save language preference"
        >
          <Text className="text-white text-base font-bold">Save</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
