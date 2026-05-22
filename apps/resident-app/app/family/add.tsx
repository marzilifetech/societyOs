import { ScrollView, View, Text, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { DateField } from '../../src/components/common/DateField';

const RELATIONSHIPS = ['Spouse', 'Son', 'Daughter', 'Parent', 'Sibling', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function AddFamilyMemberScreen() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [isEmergencyContact, setIsEmergencyContact] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: object) => api.post('/family-members', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-members'] });
      Alert.alert('Added', 'Family member registered successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message ?? 'Could not add family member. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter a name.'); return; }
    if (!relationship) { Alert.alert('Required', 'Please select a relationship.'); return; }
    mutation.mutate({
      name: name.trim(),
      relationship,
      phone: phone.trim() || undefined,
      dateOfBirth: dateOfBirth.trim() || undefined,
      bloodGroup: bloodGroup || undefined,
      isEmergencyContact,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-gray-900 text-2xl font-bold flex-1">Add Family Member</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Text className="text-gray-500 text-xs font-semibold mb-2 mt-2" style={{ letterSpacing: 0.5 }}>FULL NAME *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter name"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-100 rounded-2xl text-gray-900 text-base mb-5"
          style={{ padding: 16, minHeight: 52 }}
        />

        <Text className="text-gray-500 text-xs font-semibold mb-2.5" style={{ letterSpacing: 0.5 }}>RELATIONSHIP *</Text>
        <View className="flex-row flex-wrap mb-5" style={{ gap: 10 }}>
          {RELATIONSHIPS.map((r) => {
            const active = relationship === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRelationship(r)}
                className={`rounded-xl px-4 py-2.5 border ${active ? 'bg-primary-50 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
              >
                <Text className={`font-semibold text-sm ${active ? 'text-primary-700' : 'text-gray-700'}`}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-2" style={{ letterSpacing: 0.5 }}>PHONE</Text>
        <View className="bg-gray-100 rounded-2xl flex-row items-center px-4 mb-5">
          <Ionicons name="call" size={18} color="#9CA3AF" />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Mobile number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            className="flex-1 text-gray-900 text-base ml-2"
            style={{ paddingVertical: 16, minHeight: 52 }}
          />
        </View>

        <View className="mb-5">
          <DateField label="Date of Birth" value={dateOfBirth} onChange={setDateOfBirth} mode="date" maximumDate={new Date()} />
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-2.5" style={{ letterSpacing: 0.5 }}>BLOOD GROUP</Text>
        <View className="flex-row flex-wrap mb-5" style={{ gap: 10 }}>
          {BLOOD_GROUPS.map((bg) => {
            const active = bloodGroup === bg;
            return (
              <TouchableOpacity
                key={bg}
                onPress={() => setBloodGroup(bloodGroup === bg ? '' : bg)}
                className={`rounded-xl px-4 py-2.5 border ${active ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-200'}`}
              >
                <Text className={`font-bold text-sm ${active ? 'text-red-600' : 'text-gray-700'}`}>{bg}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-8">
          <View className="flex-1 pr-3">
            <Text className="text-gray-900 text-base font-semibold">Emergency Contact</Text>
            <Text className="text-gray-500 text-xs mt-0.5">Mark as SOS contact</Text>
          </View>
          <Switch
            value={isEmergencyContact}
            onValueChange={setIsEmergencyContact}
            trackColor={{ false: '#E5E7EB', true: '#821A52' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={mutation.isPending}
          className="bg-primary-500 rounded-2xl py-4 items-center flex-row justify-center"
          style={{ gap: 8 }}
        >
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text className="text-white text-base font-bold">
            {mutation.isPending ? 'Saving…' : 'Add Family Member'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
