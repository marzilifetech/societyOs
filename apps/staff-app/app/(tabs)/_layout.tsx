import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import i18nInstance from '../../src/lib/i18n';
import { useColorScheme } from 'nativewind';
import { useSettingsStore } from '../../src/store/settings.store';
import { colors } from '@societyos/theme';

const ACTIVE_LIGHT = colors.primary[500];
const ACTIVE_DARK = colors.primary[200];
const INACTIVE_LIGHT = '#9CA3AF';
const INACTIVE_DARK = '#6B7280';

type TabIconName = ComponentProps<typeof Ionicons>['name'];

function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -2,
        right: -10,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#EF4444',
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

/** Icon only — labels use the tab bar’s label slot so they aren’t squeezed into the icon area. */
function TabIcon({
  name,
  focusedName,
  focused,
  color,
  badge,
}: {
  name: TabIconName;
  focusedName: TabIconName;
  focused: boolean;
  color: string;
  badge?: number;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={focused ? focusedName : name} size={focused ? 24 : 22} color={color} />
      <Badge count={badge ?? 0} />
    </View>
  );
}

function tabBarLabel(text: string) {
  return function TabBarLabel({ focused, color }: { focused: boolean; color: string }) {
    return (
      <Text
        numberOfLines={1}
        style={{
          color,
          // 14/17 overflowed the tab bar's content box: 4 (icon margin) + 24
          // (icon) + 2 + 17 (label) = 47px inside a 50px slot, before React
          // Navigation's own item padding — so descenders and the whole last
          // line were clipped ("Home"/"Profile" cut in half on device).
          // 12/15 is also the conventional tab-label size.
          fontSize: 12,
          lineHeight: 15,
          fontWeight: focused ? '600' : '500',
          marginTop: 2,
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    );
  };
}

export default function TabLayout() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const badges = useSettingsStore((s) => s.badges);
  const insets = useSafeAreaInsets();

  // Honour the device's safe-area inset (home indicator on iPhone, gesture
  // pill on Android). Previously paddingBottom was a hardcoded 10px, which
  // OVERRODE React Navigation's auto safe-area handling — on devices with
  // a non-zero bottom inset the system pill drew on top of the tab content,
  // leaving a visible "line" at the bottom of the screen. We also flatten
  // the default top hairline (borderTopWidth=0): it was near-invisible in
  // dark mode but turned into a stark horizontal line once light became
  // the default theme.
  const bottomPad = Math.max(insets.bottom, 8);
  // 56 left only 50px of content once paddingTop was applied, which the
  // icon + label stack did not fit into (see tabBarLabel below). 62 gives
  // the stack ~8px of headroom so labels are never clipped, on top of the
  // device's own bottom inset.
  const tabBarHeight = 62 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: isDark ? ACTIVE_DARK : ACTIVE_LIGHT,
        tabBarInactiveTintColor: isDark ? INACTIVE_DARK : INACTIVE_LIGHT,
        tabBarIconStyle: { marginTop: 4 },
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: bottomPad,
          paddingHorizontal: 0,
          backgroundColor: isDark ? '#030712' : '#ffffff',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: tabBarLabel(t('tabs.home')),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home-outline" focusedName="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: t('tabs.duty'),
          tabBarLabel: tabBarLabel(t('tabs.duty')),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="clipboard-outline" focusedName="clipboard" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          tabBarLabel: tabBarLabel(t('tabs.tasks')),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name="checkmark-circle-outline"
              focusedName="checkmark-circle"
              focused={focused}
              color={color}
              badge={badges.tasks}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: tabBarLabel(t('tabs.profile')),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="person-outline" focusedName="person" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
