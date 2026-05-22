import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

export default function PendingApprovalScreen() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<any>('/auth/me'),
    refetchInterval: 15000,
  });

  const profileQuery = useQuery({
    queryKey: ['resident-profile-pending'],
    queryFn: () => api.get<any>('/residents/me'),
    retry: false,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (meQuery.data?.status) {
      updateUser({
        name: meQuery.data.name,
        phone: meQuery.data.phone,
        status: meQuery.data.status,
      });
      if (meQuery.data.status === 'ACTIVE') {
        router.replace('/(tabs)');
      }
    }
  }, [meQuery.data, updateUser]);

  const residentProfile = profileQuery.data;
  const needsSetup = !profileQuery.isLoading && !residentProfile;
  const isRejected = meQuery.data?.status === 'REJECTED';
  const adminNote = meQuery.data?.adminNote;

  const handleSignOut = async () => {
    await clearAuth();
    router.replace('/(auth)/society-select');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-12 items-center">
          {/* Pulsing orb */}
          <View className="items-center mb-10">
            <Animated.View
              className="w-32 h-32 rounded-full bg-primary-50 items-center justify-center"
              style={{ opacity: pulseAnim }}
            >
              <View className="w-20 h-20 rounded-full bg-primary-100 items-center justify-center">
                <View className="w-14 h-14 rounded-full bg-primary-500 items-center justify-center">
                  <Ionicons name="hourglass" size={28} color="#FFFFFF" />
                </View>
              </View>
            </Animated.View>
          </View>

          <Text className="text-3xl font-bold text-gray-900 text-center mb-3">Under Review</Text>
          <Text className="text-base text-gray-500 text-center leading-6 mb-2">
            {needsSetup
              ? 'We still need your flat details before the society team can approve access.'
              : 'Your resident profile has been received. The society team will verify your access soon.'}
          </Text>

          {(meQuery.isLoading || profileQuery.isLoading) && (
            <View className="py-6">
              <ActivityIndicator color="#821A52" size="large" />
            </View>
          )}

          <Text className="text-sm text-gray-400 mb-8">
            Checking status automatically every 15 seconds...
          </Text>
        </View>

        <View className="px-5">
          {/* Rejection banner */}
          {isRejected && (
            <View className="bg-red-100 rounded-2xl p-5 mb-4 border border-red-200">
              <View className="flex-row items-center mb-1.5">
                <Ionicons name="alert-circle" size={18} color="#B91C1C" />
                <Text className="text-red-700 text-base font-bold ml-2">Application Rejected</Text>
              </View>
              {adminNote ? (
                <Text className="text-red-700 text-base leading-6">{adminNote}</Text>
              ) : (
                <Text className="text-red-700 text-base">
                  Please contact your society office for details.
                </Text>
              )}
            </View>
          )}

          {/* What happens next card */}
          {!meQuery.isLoading && !isRejected && (
            <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
              <Text className="text-primary-500 text-xs font-bold tracking-widest uppercase mb-3">
                What happens next
              </Text>
              <Text className="text-gray-700 text-base leading-6 mb-1.5">
                1. The society office checks your mobile number and flat details.
              </Text>
              <Text className="text-gray-700 text-base leading-6 mb-1.5">
                2. Once approved, your resident features will open automatically.
              </Text>
              <Text className="text-gray-700 text-base leading-6">
                3. If this takes too long, please call your society office for help.
              </Text>
            </View>
          )}

          {/* Resident profile card */}
          {residentProfile && (
            <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
              <Text className="text-gray-900 text-lg font-bold mb-2">
                {residentProfile.user?.name ?? user?.name ?? 'Resident'}
              </Text>
              <Text className="text-gray-500 text-base mb-1">
                Flat {residentProfile.flat?.block}-{residentProfile.flat?.number}
              </Text>
              <Text className="text-gray-500 text-base">
                {residentProfile.type === 'OWNER' ? 'Owner' : 'Tenant'}
              </Text>
            </View>
          )}

          {/* Action buttons */}
          {needsSetup ? (
            <>
              <TouchableOpacity
                className="bg-primary-500 rounded-2xl h-14 items-center justify-center mb-3"
                onPress={() => router.push('/(auth)/profile-setup')}
              >
                <Text className="text-white text-base font-bold">Complete Home Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-primary-50 rounded-2xl h-14 items-center justify-center mb-3 border border-primary-500"
                onPress={() => router.push('/(auth)/documents')}
              >
                <Text className="text-primary-500 text-base font-bold">Upload ID Documents</Text>
              </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity
            className="bg-gray-50 rounded-2xl h-14 items-center justify-center border border-gray-200"
            onPress={handleSignOut}
          >
            <Text className="text-gray-500 text-base font-semibold">Use Another Number</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
