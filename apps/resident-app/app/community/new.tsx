import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Category = 'General' | 'Question' | 'Announcement';
type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORIES: { label: Category; icon: IoniconName; color: string }[] = [
  { label: 'General', icon: 'chatbubbles', color: '#821A52' },
  { label: 'Question', icon: 'help-circle', color: '#F59E0B' },
  { label: 'Announcement', icon: 'megaphone', color: '#10B981' },
];

export default function NewPostScreen() {
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [category, setCategory] = useState<Category>('General');

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/community/posts', { content, isAnonymous, category, photoUrls: [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-posts'] });
      router.back();
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to post'),
  });

  const isValid = content.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <TouchableOpacity onPress={() => router.back()} className="py-1 pr-3">
            <Text className="text-primary-500 text-base font-medium">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-gray-900 text-base font-semibold">New Post</Text>
          <TouchableOpacity
            onPress={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className={`px-4 py-2 rounded-xl ${isValid && !mutation.isPending ? 'bg-primary-500' : 'bg-gray-100'}`}
          >
            {mutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className={`font-semibold text-sm ${isValid ? 'text-white' : 'text-gray-400'}`}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          <Text className="text-gray-500 text-xs font-semibold uppercase mb-2.5" style={{ letterSpacing: 0.8 }}>Category</Text>
          <View className="flex-row mb-5" style={{ gap: 10 }}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.label;
              return (
                <TouchableOpacity
                  key={cat.label}
                  onPress={() => setCategory(cat.label)}
                  className={`flex-row items-center px-3.5 py-2 rounded-full border ${active ? 'bg-primary-50 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
                  style={{ gap: 6 }}
                >
                  <Ionicons name={cat.icon} size={14} color={active ? cat.color : '#6B7280'} />
                  <Text className={`text-xs ${active ? 'text-primary-700 font-semibold' : 'text-gray-700'}`}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            className="text-gray-900"
            style={{ fontSize: 15, lineHeight: 22, minHeight: 160, textAlignVertical: 'top' }}
            placeholder="Share something with your community…"
            placeholderTextColor="#9CA3AF"
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            textAlignVertical="top"
          />

          <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 mt-5">
            <View className="flex-1 pr-3">
              <Text className="text-gray-900 font-medium text-sm">Post anonymously</Text>
              <Text className="text-gray-500 text-xs mt-0.5">Your name will be hidden from other residents</Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: '#E5E7EB', true: '#821A52' }}
              thumbColor="#fff"
            />
          </View>

          <Text className="text-gray-400 text-xs mt-4 leading-5">
            By posting, you agree to keep the conversation respectful and relevant to your society community.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
