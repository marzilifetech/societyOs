import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="society-select">
      <Stack.Screen name="society-select" />
      <Stack.Screen name="phone-entry" />
      <Stack.Screen name="otp-verify" />
      <Stack.Screen name="pin-setup" />
      <Stack.Screen name="pin-login" />
    </Stack>
  );
}
