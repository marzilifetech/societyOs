import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { CategoryPill } from '../../src/components/community/CategoryPill';
import { WebView } from 'react-native-webview';
import { VideoView, useVideoPlayer } from 'expo-video';

type Material = {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: 'PDF' | 'MP4' | string;
  category?: string;
};

const CATEGORIES = ['All', 'Onboarding', 'Safety', 'Trade', 'Soft Skills'] as const;
type Cat = typeof CATEGORIES[number];

function fileKindFromUrl(m: Material): 'PDF' | 'MP4' | 'OTHER' {
  if (m.fileType === 'PDF' || /\.pdf(\?|$)/i.test(m.fileUrl)) return 'PDF';
  if (m.fileType === 'MP4' || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(m.fileUrl)) return 'MP4';
  return 'OTHER';
}

export default function TrainingScreen() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('All');
  const [open, setOpen] = useState<Material | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['training', cat],
    queryFn: () =>
      api
        .get<Material[]>(`/staff/community/training${cat === 'All' ? '' : `?category=${cat}`}`)
        .catch((e) => {
          console.warn('[training] fetch failed', e?.message);
          return [] as Material[];
        }),
  });

  const filtered = (data ?? []).filter(
    (m) => !q.trim() || m.title.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-4 pb-3 bg-white">
        <TextInput
          className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-900 mb-3"
          placeholder="Search training…"
          placeholderTextColor="#9CA3AF"
          value={q}
          onChangeText={setQ}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                className={`px-3 py-1.5 rounded-full border ${
                  cat === c ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'
                }`}
                onPress={() => setCat(c)}
              >
                <Text className={`text-xs font-medium ${cat === c ? 'text-white' : 'text-gray-600'}`}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-4xl mb-3">📚</Text>
          <Text className="text-gray-400">No training materials</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => {
            const kind = fileKindFromUrl(item);
            const icon = kind === 'PDF' ? '📄' : kind === 'MP4' ? '🎬' : '📎';
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                className="bg-white rounded-2xl p-4 flex-row items-center"
                onPress={() => setOpen(item)}
              >
                <View className="bg-primary-50 w-12 h-12 rounded-xl items-center justify-center mr-3">
                  <Text className="text-xl">{icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">{item.title}</Text>
                  {item.description && (
                    <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>{item.description}</Text>
                  )}
                  {item.category && (
                    <View className="mt-2">
                      <CategoryPill category={item.category} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Viewer modal */}
      <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 flex-1" numberOfLines={1}>
              {open?.title}
            </Text>
            <TouchableOpacity onPress={() => setOpen(null)} className="px-3 py-1.5">
              <Text className="text-primary-500 font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
          {open && <Viewer material={open} />}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Viewer({ material }: { material: Material }) {
  const kind = fileKindFromUrl(material);

  if (kind === 'PDF') {
    const src = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(material.fileUrl)}`;
    return <WebView source={{ uri: src }} style={{ flex: 1 }} />;
  }

  if (kind === 'MP4') {
    return <VideoPlayerInline url={material.fileUrl} />;
  }

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-gray-500 text-sm">Unsupported file type</Text>
    </View>
  );
}

function VideoPlayerInline({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  return <VideoView style={{ flex: 1 }} player={player} allowsFullscreen allowsPictureInPicture />;
}
