import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { PendingVisitorsPill } from '../../src/components/PendingVisitorsPill';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  focused: boolean;
  name: IoniconName;
  label: string;
}

function TabIcon({ focused, name, label }: TabIconProps) {
  const t = useTheme();
  const color = focused ? t.accentPrimary : t.textMuted;
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
 * Redirect ONLY on a genuine 404 (no Resident row). A transient network / 5xx
 * error must NOT bounce — otherwise this guard fights pending-approval's
 * `status === 'ACTIVE' → /(tabs)` redirect and the app flicker-loops forever
 * (ACTIVE user without a profile ping-pongs between the two screens). 401 is
 * handled by the api-client's onUnauthorized (→ society-select), not here.
 */
function ResidentProfileGuard() {
  const { isError, error } = useQuery({
    queryKey: ['residents-me-guard'],
    queryFn: () => api.get('/residents/me'),
    retry: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (isError && (error as { status?: number } | null)?.status === 404) {
      router.replace('/(auth)/pending-approval' as any);
    }
  }, [isError, error]);
  return null;
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  return (
    <>
    <ResidentProfileGuard />
    {/*
      Guard-logged entry requests need an in-app surface.

      When security logs a visitor at the gate the row is created PENDING and a
      push goes out — but the push is the ONLY notification, so a resident with
      push disabled, no token, or the app already open saw nothing at all: the
      "entry request is not shown in the resident app" report. This component
      polls for pending approvals and shows an approve/deny card. It existed and
      was fully written, but was never mounted anywhere.
    */}
    <PendingVisitorsPill />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: t.borderSubtle,
          height: 66 + bottomPad,
          paddingBottom: bottomPad,
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
