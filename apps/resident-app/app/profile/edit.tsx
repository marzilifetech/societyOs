import { useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Profile = {
  user?: { name?: string; email?: string; phone?: string };
};

export default function EditProfileScreen() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const { data, isLoading } = useQuery<Profile>({
    queryKey: ['resident-profile'],
    queryFn: () => api.get<Profile>('/residents/me'),
  });

  useEffect(() => {
    if (data?.user) {
      setName(data.user.name ?? '');
      setEmail(data.user.email ?? '');
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch('/residents/me', {
        name: name.trim(),
        email: email.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resident-profile'] });
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not save profile.'),
  });

  const isValid = name.trim().length >= 2;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Edit Profile</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#821A52" size="large" style={{ marginTop: 64 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 }}>
          <Text className="text-gray-500 text-xs font-semibold mb-2 uppercase tracking-wide">Full Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-100 border border-gray-200 rounded-xl px-4 text-base text-gray-900 mb-5"
            style={{ minHeight: 52, paddingVertical: 14 }}
          />

          <Text className="text-gray-500 text-xs font-semibold mb-2 uppercase tracking-wide">Email (optional)</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            className="bg-gray-100 border border-gray-200 rounded-xl px-4 text-base text-gray-900 mb-5"
            style={{ minHeight: 52, paddingVertical: 14 }}
          />

          {data?.user?.phone && (
            <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5">
              <Text className="text-gray-500 text-xs">Phone</Text>
              <Text className="text-gray-900 text-base">{data.user.phone}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">Contact admin to change your phone</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className={`rounded-2xl py-4 items-center mt-2 ${isValid ? 'bg-primary-500' : 'bg-gray-200'}`}
            style={{ minHeight: 56 }}
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-semibold ${isValid ? 'text-white' : 'text-gray-400'}`}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
