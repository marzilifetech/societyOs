import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { useColorScheme } from 'nativewind';
import { useSettingsStore } from '../../src/store/settings.store';

const ACTIVE_LIGHT = '#821A52';
const ACTIVE_DARK = '#93C5FD';
const INACTIVE_LIGHT = '#9CA3AF';
const INACTIVE_DARK = '#6B7280';

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

/** Emoji only — labels use the tab bar’s label slot so they aren’t squeezed into the icon area. */
function TabEmoji({ emoji, focused, badge }: { emoji: string; focused: boolean; badge?: number }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{emoji}</Text>
      <Badge count={badge ?? 0} />
    </View>
  );
}

function tabBarLabel(text: string) {
  return function TabBarLabel({ focused, color }: { focused: boolean; color: string }) {
    return (
      <Text
        style={{
          color,
          fontSize: 14,
          lineHeight: 17,
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: isDark ? ACTIVE_DARK : ACTIVE_LIGHT,
        tabBarInactiveTintColor: isDark ? INACTIVE_DARK : INACTIVE_LIGHT,
        tabBarIconStyle: { marginTop: 4 },
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: 10,
          paddingHorizontal: 0,
          backgroundColor: isDark ? '#030712' : '#ffffff',
          borderTopColor: isDark ? '#1f2937' : '#F3F4F6',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: tabBarLabel(t('tabs.home')),
          tabBarIcon: ({ focused }) => <TabEmoji emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: t('tabs.duty'),
          tabBarLabel: tabBarLabel(t('tabs.duty')),
          tabBarIcon: ({ focused }) => <TabEmoji emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          tabBarLabel: tabBarLabel(t('tabs.tasks')),
          tabBarIcon: ({ focused }) => (
            <TabEmoji emoji="✅" focused={focused} badge={badges.tasks} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: tabBarLabel(t('tabs.profile')),
          tabBarIcon: ({ focused }) => <TabEmoji emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
