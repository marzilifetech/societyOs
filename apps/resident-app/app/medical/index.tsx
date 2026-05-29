import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { ScreenHeader } from '../../src/components/ui';

// Public Figma reference (Med Help Desk Appointments frame): node-id=56-6126
// Behaviour-preserving redesign — same /medical/doctors + /medical/emergency-contacts
// queries; new ScreenHeader (with SOS trailing affordance) primitive.

type Doctor = {
  id: string;
  name: string;
  specialization: string;
  qualifications?: string;
  availableDays?: string[];
  nextSlot?: string;
  rating?: number;
};

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  role: string;
};

export default function MedicalScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const t = useTheme();

  const { data: doctors, isLoading, isError, refetch: refetchDoctors } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => api.get<Doctor[]>('/medical/doctors'),
  });

  const { data: contacts, refetch: refetchContacts } = useQuery<EmergencyContact[]>({
    queryKey: ['emergency-contacts'],
    queryFn: () => api.get<EmergencyContact[]>('/medical/emergency-contacts'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDoctors(), refetchContacts()]);
    setRefreshing(false);
  };

  const sosButton = (
    <TouchableOpacity
      onPress={() => router.push('/medical/sos' as any)}
      style={{ minHeight: t.touchTargetSm }}
      className="bg-red-600 rounded-2xl px-4 py-3 flex-row items-center gap-1.5 justify-center"
      accessibilityRole="button"
      accessibilityLabel="Emergency SOS - call for immediate help"
    >
      <Ionicons name="warning" size={18} color="#FFFFFF" />
      <Text className="text-white font-semibold text-sm">SOS</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Medical" subtitle="Book a doctor appointment" trailing={sosButton} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* My Appointments */}
        <TouchableOpacity
          onPress={() => router.push('/medical/appointments' as any)}
          style={{ minHeight: t.touchTarget }}
          className="mx-6 mb-6 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 flex-row items-center justify-between"
          accessibilityRole="button"
          accessibilityLabel="My Appointments - view upcoming and past bookings"
        >
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-11 h-11 rounded-xl bg-primary-50 items-center justify-center">
              <Ionicons name="calendar" size={22} color="#821A52" />
            </View>
            <View className="flex-1">
              <Text className="text-primary-500 font-semibold text-base">My Appointments</Text>
              <Text className="text-gray-500 text-sm mt-0.5">View upcoming and past bookings</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#821A52" />
        </TouchableOpacity>

        <Text className="text-xl font-semibold text-gray-900 px-6 mb-4">Available Doctors</Text>

        {isLoading ? (
          <View className="items-center py-20">
            <ActivityIndicator color="#821A52" size="large" />
          </View>
        ) : isError ? (
          <View className="items-center py-20 px-8">
            <View className="w-16 h-16 rounded-2xl bg-red-50 items-center justify-center mb-4">
              <Ionicons name="alert-circle" size={32} color="#DC2626" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold mb-4">Failed to load doctors</Text>
            <TouchableOpacity
              onPress={() => refetchDoctors()}
              style={{ minHeight: t.touchTarget }}
              className="bg-primary-500 rounded-xl px-6 py-3 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Retry loading doctors"
            >
              <Text className="text-white font-semibold text-base">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !doctors?.length ? (
          <View className="items-center py-20 px-8">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="medkit" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold">No doctors available</Text>
          </View>
        ) : (
          <View className="px-6 gap-3">
            {doctors.map((doc: any) => (
              <TouchableOpacity
                key={doc.id}
                onPress={() => router.push(`/medical/${doc.id}` as any)}
                style={{ padding: t.cardPadding }}
                className="bg-gray-50 border border-gray-200 rounded-2xl"
                accessibilityRole="button"
                accessibilityLabel={`Dr. ${doc.name}, ${doc.specialization}`}
              >
                <View className="flex-row items-center gap-4">
                  <View className="w-14 h-14 rounded-2xl bg-primary-50 items-center justify-center">
                    <Ionicons name="medkit" size={28} color="#821A52" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 text-base font-semibold">Dr. {doc.name}</Text>
                    <Text className="text-primary-500 text-sm mt-0.5">{doc.specialization}</Text>
                    {doc.qualifications ? (
                      <Text className="text-gray-500 text-xs mt-0.5">{doc.qualifications}</Text>
                    ) : null}
                    {doc.nextSlot ? (
                      <View className="flex-row items-center gap-1 mt-1">
                        <Ionicons name="time" size={12} color="#16A34A" />
                        <Text className="text-green-600 text-xs">Next: {doc.nextSlot}</Text>
                      </View>
                    ) : null}
                  </View>
                  {doc.rating ? (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text className="text-amber-600 text-sm font-medium">{doc.rating.toFixed(1)}</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/medical/book', params: { doctorId: doc.id } } as any)}
                  style={{ minHeight: t.touchTarget }}
                  className="bg-primary-500 rounded-xl py-3 mt-3 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={`Book appointment with Dr. ${doc.name}`}
                >
                  <Text className="text-white font-semibold text-sm">Book Appointment</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Emergency contacts */}
        {contacts?.length ? (
          <View className="px-6 mt-8">
            <Text className="text-gray-900 text-xl font-semibold mb-3">Emergency Contacts</Text>
            <View className="bg-red-50 border border-red-200 rounded-2xl p-4 gap-3">
              {contacts.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  className="flex-row items-center justify-between"
                  style={{ minHeight: t.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${c.name}, ${c.role}, ${c.phone}`}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-10 h-10 rounded-xl bg-red-100 items-center justify-center">
                      <Ionicons name="call" size={18} color="#DC2626" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-900 font-semibold text-base">{c.name}</Text>
                      <Text className="text-gray-500 text-xs">{c.role}</Text>
                    </View>
                  </View>
                  <Text className="text-red-600 font-bold text-base">{c.phone}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
