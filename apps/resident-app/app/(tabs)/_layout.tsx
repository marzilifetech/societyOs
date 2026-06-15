import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  focused: boolean;
  name: IoniconName;
  label: string;
}

function TabIcon({ focused, name, label }: TabIconProps) {
  const color = focused ? '#821A52' : '#9CA3AF';
  return (
    <View className="items-center pt-1" style={{ width: 64 }}>
      <Ionicons name={name} size={22} color={color} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ fontSize: 11, marginTop: 3, color, fontWeight: focused ? '700' : '500' }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Root tabs guard — every tab below requires a Resident row to exist. If the
 * user lands here without one (status mismatch, manual admin edit, stale
 * session, deep-link from a backgrounded notification), the home / services /
 * profile screens would all 404 against /residents/me with a cryptic "Resident
 * profile not found" message. This guard catches all of them in one place and
 * sends the user back to pending-approval where they can complete profile-setup.
 *
 * No retry — a single 404 is enough signal; a transient network error would
 * leave them on a broken tab, which is preferable to a flicker loop.
 */
function ResidentProfileGuard() {
  const { isError } = useQuery({
    queryKey: ['residents-me-guard'],
    queryFn: () => api.get('/residents/me'),
    retry: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (isError) router.replace('/(auth)/pending-approval' as any);
  }, [isError]);
  return null;
}

export default function TabsLayout() {
  return (
    <>
    <ResidentProfileGuard />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F1F3',
          height: 84,
          paddingBottom: 18,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name={focused ? 'home' : 'home-outline'} label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name={focused ? 'construct' : 'construct-outline'} label="Services" />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name={focused ? 'calendar' : 'calendar-outline'} label="Events" />
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name={focused ? 'megaphone' : 'megaphone-outline'} label="Notices" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name={focused ? 'person' : 'person-outline'} label="Profile" />
          ),
        }}
      />
      {/* Visitors moved out of the tab bar per the Figma nav (still routable at /visitors). */}
      <Tabs.Screen name="visitors" options={{ href: null }} />
    </Tabs>
    </>
  );
}
