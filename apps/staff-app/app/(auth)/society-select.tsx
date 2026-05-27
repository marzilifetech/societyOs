import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/lib/api';

interface Society {
  id: string;
  name: string;
  city: string;
}

export default function SocietySelectScreen() {
  const [search, setSearch] = useState('');

  const { data: societies, isLoading } = useQuery<Society[]>({
    queryKey: ['societies'],
    queryFn: () => api.get<Society[]>('/societies'),
  });

  const filtered = societies?.filter(
    (s: Society) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (society: Society) => {
    router.push({
      pathname: '/(auth)/phone-entry',
      params: { societyId: society.id, societyName: society.name },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 mb-2">Find your society</Text>
          <Text className="text-base text-gray-500">Staff sign-in — search by name or city</Text>
        </View>

        <View className="flex-row items-center bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3.5 mb-5">
          <TextInput
            className="flex-1 text-base text-gray-900"
            placeholder="Search societies..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>

        {isLoading ? (
          <View className="items-center pt-10">
            <ActivityIndicator color="#821A52" size="large" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 mb-2.5 min-h-[72px] justify-center"
              >
                <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                <Text className="text-sm text-gray-500 mt-1">{item.city}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="items-center pt-16">
                <Text className="text-base text-gray-500 text-center">No societies found</Text>
                <Text className="text-sm text-gray-400 text-center mt-1.5">Ask your society admin to register</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
