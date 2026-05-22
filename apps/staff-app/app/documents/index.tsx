import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image, Dimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import WebView from 'react-native-webview';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';

interface StaffDocument {
  id: string;
  type: string;
  name?: string;
  fileUrl: string;
  status?: 'VERIFIED' | 'PENDING' | string;
  uploadedAt?: string;
}

const ICONS: Record<string, string> = {
  AADHAAR: '🆔',
  PAN: '💳',
  CONTRACT: '📄',
  CERTIFICATION: '🎓',
  OTHER: '📎',
};

export default function DocumentsScreen() {
  const [preview, setPreview] = useState<StaffDocument | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-documents'],
    queryFn: () => api.get<StaffDocument[]>('/staff/documents'),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Documents</Text>
        <TouchableOpacity
          onPress={() => router.push('/documents/upload' as any)}
          className="w-10 h-10 items-center justify-center"
        >
          <Text className="text-white text-2xl">+</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <ErrorCard
          message="Your documents couldn't be loaded. Please try again."
          onRetry={() => refetch()}
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-5 gap-3" showsVerticalScrollIndicator={false}>
          {(data ?? []).length === 0 ? (
            <EmptyState onUpload={() => router.push('/documents/upload' as any)} />
          ) : (
            (data ?? []).map((doc) => (
              <TouchableOpacity
                key={doc.id}
                onPress={() => setPreview(doc)}
                className="bg-white rounded-2xl p-4 flex-row items-center gap-3 shadow-sm"
              >
                <Text className="text-3xl">{ICONS[doc.type] ?? '📎'}</Text>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{doc.name ?? doc.type}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}
                  </Text>
                </View>
                <StatusPill status={doc.status} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <PreviewModal doc={preview} onClose={() => setPreview(null)} />
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status?: string }) {
  const verified = status === 'VERIFIED';
  return (
    <View className={`px-2.5 py-1 rounded-full ${verified ? 'bg-green-100' : 'bg-amber-100'}`}>
      <Text className={`text-xs font-semibold ${verified ? 'text-green-700' : 'text-amber-700'}`}>
        {verified ? 'Verified' : 'Pending'}
      </Text>
    </View>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <View className="bg-white rounded-2xl p-8 items-center mt-8">
      <Text className="text-5xl mb-3">📁</Text>
      <Text className="text-gray-700 font-semibold text-base mb-1">No documents yet</Text>
      <Text className="text-gray-500 text-sm text-center mb-4">Upload Aadhaar, PAN or contract to keep them handy.</Text>
      <TouchableOpacity onPress={onUpload} className="bg-primary-500 px-5 py-2.5 rounded-xl">
        <Text className="text-white font-semibold">Upload Document</Text>
      </TouchableOpacity>
    </View>
  );
}

function PreviewModal({ doc, onClose }: { doc: StaffDocument | null; onClose: () => void }) {
  const isPdf = doc?.fileUrl?.toLowerCase().endsWith('.pdf');
  const { width, height } = Dimensions.get('window');
  return (
    <Modal visible={!!doc} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-4 py-3">
          <TouchableOpacity onPress={onClose} className="px-2 py-1">
            <Text className="text-white text-base">Close</Text>
          </TouchableOpacity>
          <Text className="text-white font-semibold">{doc?.name ?? doc?.type ?? 'Preview'}</Text>
          <View className="w-12" />
        </View>
        {doc ? (
          isPdf ? (
            <WebView source={{ uri: doc.fileUrl }} style={{ flex: 1 }} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Image source={{ uri: doc.fileUrl }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
            </View>
          )
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
