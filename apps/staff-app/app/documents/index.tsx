import { useState, type ComponentProps } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image, Dimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';
import { AppHeader, Button, Card, EmptyState as EmptyStateBase } from '../../src/components/ui';

interface StaffDocument {
  id: string;
  type: string;
  name?: string;
  fileUrl: string;
  status?: 'VERIFIED' | 'PENDING' | string;
  uploadedAt?: string;
}

type DocIcon = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, DocIcon> = {
  AADHAAR: 'id-card-outline',
  PAN: 'card-outline',
  CONTRACT: 'document-text-outline',
  CERTIFICATION: 'school-outline',
  OTHER: 'attach-outline',
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
      <AppHeader
        title="Documents"
        right={
          <TouchableOpacity
            onPress={() => router.push('/documents/upload' as any)}
            className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Upload document"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

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
                <View className="w-11 h-11 rounded-full bg-primary-50 items-center justify-center">
                  <Ionicons name={ICONS[doc.type] ?? 'attach-outline'} size={20} color={colors.primary[500]} />
                </View>
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
    <Card padding="none" className="items-center mt-8 pb-8">
      <EmptyStateBase
        icon="folder-open-outline"
        title="No documents yet"
        body="Upload Aadhaar, PAN or contract to keep them handy."
        className="pb-0"
      />
      <Button label="Upload Document" onPress={onUpload} className="mt-4" />
    </Card>
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
