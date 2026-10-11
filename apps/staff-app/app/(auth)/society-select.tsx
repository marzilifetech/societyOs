import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUnwrappedArray } from '../../src/lib/unwrapped-get';

interface Society {
  id: string;
  name: string;
  city: string | null;
}

export default function SocietySelectScreen() {
  const [search, setSearch] = useState('');

  const { data: societies, isLoading, isError, refetch, isRefetching } = useQuery<Society[]>({
    queryKey: ['societies'],
    queryFn: () => getUnwrappedArray<Society>('/societies'),
  });

  const q = search.trim().toLowerCase();
  // `city` can be missing; `.toLowerCase()` on it crashed the first screen.
  const filtered = societies?.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q),
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
            accessibilityLabel="Search societies"
          />
        </View>

        {isLoading ? (
          <View className="items-center pt-10">
            <ActivityIndicator color="#821A52" size="large" />
          </View>
        ) : isError ? (
          // Offline or a server error used to read "No societies found" with
          // no way forward, on the very first screen of the app.
          <View className="items-center pt-16 px-4">
            <Text className="text-base text-gray-700 text-center">
              Couldn't load societies. Check your internet connection.
            </Text>
            <TouchableOpacity
              onPress={() => void refetch()}
              disabled={isRefetching}
              accessibilityRole="button"
              className="mt-5 rounded-full bg-primary-500 px-6 py-3"
            >
              {isRefetching ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-semibold text-white">Try again</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 mb-2.5 min-h-[72px] justify-center"
              >
                <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                {item.city ? <Text className="text-sm text-gray-500 mt-1">{item.city}</Text> : null}
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
