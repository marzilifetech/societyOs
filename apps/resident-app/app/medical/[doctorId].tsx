import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Review = { id: string; rating: number; comment?: string; residentName: string; createdAt: string };
type DoctorDetail = {
  id: string;
  name: string;
  specialization: string;
  qualifications?: string;
  availableDays?: string[];
  bio?: string;
  avgRating?: number;
  ratingCount?: number;
  reviews?: Review[];
};

function Stars({ rating }: { rating: number }) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((s: any) => (
        <Ionicons key={s} name="star" size={14} color={s <= rating ? '#F59E0B' : '#E5E7EB'} />
      ))}
    </View>
  );
}

export default function DoctorProfileScreen() {
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();

  const { data: doctor, isLoading, isError, refetch } = useQuery<DoctorDetail>({
    queryKey: ['doctor', doctorId],
    queryFn: () => api.get<DoctorDetail>(`/medical/doctors/${doctorId}`),
    enabled: !!doctorId,
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-gray-900 text-xl font-bold">Doctor Profile</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-2xl bg-red-50 items-center justify-center mb-4">
            <Ionicons name="alert-circle" size={32} color="#DC2626" />
          </View>
          <Text className="text-gray-900 text-lg font-semibold mb-4">Failed to load</Text>
          <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : doctor ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {/* Profile card */}
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4 items-center">
            <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-3">
              <Ionicons name="medkit" size={40} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-2xl font-bold mb-1">Dr. {doctor.name}</Text>
            <Text className="text-primary-500 text-base mb-1">{doctor.specialization}</Text>
            {doctor.qualifications ? <Text className="text-gray-500 text-sm">{doctor.qualifications}</Text> : null}
            {doctor.avgRating ? (
              <View className="flex-row items-center gap-2 mt-3">
                <Stars rating={Math.round(doctor.avgRating)} />
                <Text className="text-gray-500 text-sm">{doctor.avgRating.toFixed(1)} ({doctor.ratingCount} reviews)</Text>
              </View>
            ) : null}
          </View>

          {doctor.bio ? (
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="information-circle" size={18} color="#821A52" />
                <Text className="text-gray-900 font-semibold">About</Text>
              </View>
              <Text className="text-gray-500 text-base leading-6">{doctor.bio}</Text>
            </View>
          ) : null}

          {doctor.availableDays?.length ? (
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="calendar" size={18} color="#821A52" />
                <Text className="text-gray-900 font-semibold">Available Days</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {doctor.availableDays.map((d: any) => (
                  <View key={d} className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-2">
                    <Text className="text-primary-500 text-sm font-semibold">{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Reviews */}
          {doctor.reviews?.length ? (
            <View className="mb-6">
              <Text className="text-gray-900 text-xl font-semibold mb-3">Patient Reviews</Text>
              {doctor.reviews.map((r: any) => (
                <View key={r.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-gray-900 font-semibold">{r.residentName}</Text>
                    <Stars rating={r.rating} />
                  </View>
                  {r.comment ? <Text className="text-gray-500 text-sm leading-5">{r.comment}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/medical/book', params: { doctorId: doctor.id } } as any)}
            className="bg-primary-500 rounded-2xl py-4 items-center flex-row justify-center gap-2"
          >
            <Ionicons name="calendar" size={18} color="#FFFFFF" />
            <Text className="text-white font-bold text-base">Book Appointment</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
