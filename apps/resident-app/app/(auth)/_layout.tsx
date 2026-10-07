import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { settleWindowBackground } from '../../src/lib/window-background';

export default function AuthLayout() {
  // A real screen is up: the launch splash behind the app can go.
  useEffect(() => settleWindowBackground(), []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
