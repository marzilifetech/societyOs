import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';
import { useAuthStore } from '../../src/store/auth.store';
import { api } from '../../src/lib/api';
import { uploadViaMedia } from '../../src/lib/photo-upload';

interface StaffProfile {
  employeeId?: string;
  designation?: string;
  team?: string;
  joinedAt?: string;
  presentDays?: number;
  leaveBalance?: number;
  tasksDone?: number;
  photoUrl?: string;
  society?: { name?: string };
}

interface EmergencyContact {
  name?: string;
  phone?: string;
  relation?: string;
}

interface SalarySnapshot {
  netPay?: number;
  period?: string;
}

export default function StaffProfileScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const { user, clearAuth } = useAuthStore();
  const qc = useQueryClient();
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const { data: profile } = useQuery<StaffProfile>({
    queryKey: ['staff-profile'],
    queryFn: () => api.get<StaffProfile>('/staff/profile'),
  });

  const { data: emergency } = useQuery<EmergencyContact>({
    queryKey: ['staff-emergency'],
    queryFn: async () => {
      try {
        return await api.get<EmergencyContact>('/staff/emergency-contact');
      } catch {
        return {};
      }
    },
  });

  const { data: latestSlip } = useQuery<SalarySnapshot[]>({
    queryKey: ['staff-salary', 'profile-snapshot'],
    queryFn: async () => {
      try {
        const res = await api.get<SalarySnapshot[]>('/staff/salary');
        return res ?? [];
      } catch {
        return [];
      }
    },
  });

  // Profile photo upload — goes through the Marzi /media proxy (same as
  // resident-app document uploads). The previous self-signed S3 PUT was
  // failing with 403 because the backend's IAM principal had no PutObject
  // permission. The /media flow uses Marzi's S3 + presigned POST, which we
  // know works.
  const photoMutation = useMutation({
    mutationFn: async (uri: string) => {
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const result = await uploadViaMedia(compressed.uri, {
        contentType: 'image/jpeg',
        visibility: 'public',
        filename: 'profile.jpg',
      });
      if (!result.publicUrl) {
        // Public uploads must come back with a CDN URL — if not, persisting
        // an empty string would clear the photo.
        throw new Error('Upload did not return a public URL');
      }
      await api.post('/staff/profile/photo', { photoUrl: result.publicUrl });
      return result.publicUrl;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-profile'] }),
    onError: (err: any) => Alert.alert('Photo upload failed', err?.message ?? 'Try again'),
  });

  const handlePhotoEdit = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.[0]) photoMutation.mutate(res.assets[0].uri);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/society-select' as any);
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and personal data per DPDP Act. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/auth/delete', {});
            } catch (err: any) {
              if (__DEV__) console.warn('[delete] failed', err?.message);
            }
            await clearAuth();
            router.replace('/(auth)/society-select' as any);
          },
        },
      ],
    );
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const slip = latestSlip?.[0];
  const projected = slip?.netPay ?? 0;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-primary-500 dark:bg-primary-900 px-6 pt-6 pb-10">
          <Text className="text-2xl font-bold text-white mb-6">{t('profile.title')}</Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={handlePhotoEdit} className="relative">
              <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center overflow-hidden">
                {profile?.photoUrl ? (
                  <Image source={{ uri: profile.photoUrl }} style={{ width: 64, height: 64 }} />
                ) : (
                  <Text className="text-white text-xl font-bold">{initials}</Text>
                )}
              </View>
              <View className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white items-center justify-center">
                {photoMutation.isPending ? (
                  <ActivityIndicator size="small" color="#821A52" />
                ) : (
                  <Text className="text-primary-500 text-xs font-bold">✎</Text>
                )}
              </View>
            </TouchableOpacity>
            <View>
              <Text className="text-white text-lg font-semibold">{user?.name ?? '—'}</Text>
              <Text className="text-blue-200 text-sm">{user?.role?.replace('_', ' ')}</Text>
              {user?.department && (
                <Text className="text-blue-300 text-xs mt-0.5">{user.department}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="px-6 -mt-4 mb-4">
          <View className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm flex-row divide-x divide-gray-100 dark:divide-gray-800 border border-transparent dark:border-gray-800">
            <StatCell label={t('profile.statPresentDays')} value={profile?.presentDays ?? '—'} />
            <StatCell label={t('profile.statLeaveBalance')} value={`${profile?.leaveBalance ?? 0}d`} />
            <StatCell label={t('profile.statTasksDone')} value={profile?.tasksDone ?? '—'} />
          </View>
        </View>

        {/* Earnings */}
        <View className="mx-6 mb-4 bg-gradient-to-r rounded-2xl bg-primary-500 p-5">
          <Text className="text-blue-200 text-xs uppercase tracking-wider">{t('profile.earnings')}</Text>
          <View className="flex-row justify-between items-end mt-2">
            <View>
              <Text className="text-white text-2xl font-bold">
                ₹{(slip?.netPay ?? 0).toLocaleString('en-IN')}
              </Text>
              <Text className="text-blue-200 dark:text-blue-300 text-xs mt-1">
                {slip?.period ? t('profile.latestPeriod', { period: slip.period }) : t('profile.thisMonth')}
              </Text>
            </View>
            <View>
              <Text className="text-blue-200 text-xs">{t('profile.projectedPayout')}</Text>
              <Text className="text-white text-base font-semibold mt-1">
                ₹{projected.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View className="mx-6 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden mb-4 border border-transparent dark:border-gray-800">
          <InfoRow label={t('profile.designation')} value={profile?.designation ?? '—'} />
          <InfoRow label={t('profile.team')} value={profile?.team ?? '—'} />
          <InfoRow label={t('profile.phone')} value={user?.phone ?? '—'} />
          <InfoRow label={t('profile.employeeId')} value={profile?.employeeId ?? '—'} />
          <InfoRow
            label={t('profile.joinedAt')}
            value={
              profile?.joinedAt
                ? new Date(profile.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'
            }
          />
          <InfoRow label={t('profile.society')} value={profile?.society?.name ?? '—'} last />
        </View>

        {/* Emergency contact */}
        <View className="mx-6 bg-white dark:bg-gray-900 rounded-2xl px-5 py-4 mb-4 shadow-sm border border-transparent dark:border-gray-800">
          <View className="flex-row justify-between items-center">
            <Text className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('profile.emergencyContact')}</Text>
            <TouchableOpacity onPress={() => setEmergencyOpen(true)}>
              <Text className="text-primary-500 dark:text-primary-400 text-sm font-semibold">{emergency?.name ? t('common.edit') : t('profile.emergencyAdd')}</Text>
            </TouchableOpacity>
          </View>
          {emergency?.name ? (
            <View className="mt-2">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">{emergency.name}</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {emergency.phone ?? '—'} · {emergency.relation ?? '—'}
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-gray-400 dark:text-gray-500 mt-2">{t('profile.emergencyEmpty')}</Text>
          )}
        </View>

        {/* Quick links */}
        <View className="mx-6 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden mb-4 border border-transparent dark:border-gray-800">
          <QuickLink icon="📁" label={t('profile.documents')} onPress={() => router.push('/documents' as any)} />
          <QuickLink icon="💰" label={t('profile.salarySlips')} onPress={() => router.push('/salary' as any)} />
          <QuickLink icon="🙋" label={t('helpRequests.title')} onPress={() => router.push('/help-requests' as any)} />
          <QuickLink icon="📅" label={t('leave.requestTitle')} onPress={() => router.push('/leave/new' as any)} />
          <QuickLink icon="📋" label={t('leave.historyTitle')} onPress={() => router.push('/leave/history' as any)} />
          <QuickLink icon="⚙️" label={t('profile.settings')} onPress={() => router.push('/settings' as any)} />
          {/* SOS — moved here from the home FAB. Still one tap away. */}
          <QuickLink icon="🚨" label="Emergency / SOS" onPress={() => router.push('/sos' as any)} />
          <QuickLink icon="❓" label={t('profile.help')} onPress={() => router.push('/settings/help' as any)} last />
        </View>

        {/* Logout */}
        <TouchableOpacity
          className="mx-6 bg-red-50 dark:bg-red-950/40 rounded-2xl py-4 items-center mb-3 border border-transparent dark:border-red-900/50"
          onPress={handleLogout}
        >
          <Text className="text-red-500 dark:text-red-400 font-semibold text-base">{t('profile.logout')}</Text>
        </TouchableOpacity>

        {/* Delete account */}
        <TouchableOpacity className="mx-6 py-3 items-center mb-2" onPress={handleDeleteAccount}>
          <Text className="text-red-400 dark:text-red-500/90 text-sm">{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>

        <View className="items-center pb-8 pt-2">
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            {t('profile.version')} {version} · SocietyOS Staff
          </Text>
        </View>
      </ScrollView>

      <EmergencyContactSheet
        visible={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        initial={emergency ?? {}}
        onSaved={() => qc.invalidateQueries({ queryKey: ['staff-emergency'] })}
      />
    </SafeAreaView>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center py-4">
      <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</Text>
      <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 text-center">{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row justify-between items-center px-5 py-3.5 ${!last ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</Text>
    </View>
  );
}

function QuickLink({ icon, label, onPress, last }: { icon: string; label: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-5 py-4 flex-row items-center ${!last ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}
    >
      <Text className="text-xl mr-3">{icon}</Text>
      <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{label}</Text>
      <Text className="text-gray-300 dark:text-gray-600 text-lg">›</Text>
    </TouchableOpacity>
  );
}

function EmergencyContactSheet({
  visible,
  onClose,
  initial,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  initial: EmergencyContact;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [relation, setRelation] = useState(initial.relation ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/staff/emergency-contact', { name, phone, relation });
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Emergency Contact</Text>
          <Text className="text-xs text-gray-500 mb-1">Name</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 mb-3 text-gray-900"
            value={name}
            onChangeText={setName}
            placeholder="Full name"
          />
          <Text className="text-xs text-gray-500 mb-1">Phone</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 mb-3 text-gray-900"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Phone number"
          />
          <Text className="text-xs text-gray-500 mb-1">Relation</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 mb-5 text-gray-900"
            value={relation}
            onChangeText={setRelation}
            placeholder="Spouse, parent…"
          />
          <View className="flex-row gap-3">
            <TouchableOpacity className="flex-1 bg-gray-100 rounded-xl py-3 items-center" onPress={onClose}>
              <Text className="text-gray-700 font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary-500 rounded-xl py-3 items-center"
              onPress={save}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
