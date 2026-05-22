import { Stack } from 'expo-router';

export default function CommunityLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: 'Community',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
      }}
    >
      <Stack.Screen name="notices" options={{ title: 'Notices' }} />
      <Stack.Screen name="messages" options={{ title: 'Messages' }} />
      <Stack.Screen name="messages/[groupId]" options={{ title: 'Group Chat' }} />
      <Stack.Screen name="training" options={{ title: 'Training' }} />
      <Stack.Screen name="recognition" options={{ title: 'Recognition' }} />
    </Stack>
  );
}
