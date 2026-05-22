import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  focused: boolean;
  name: IoniconName;
  label: string;
}

function TabIcon({ focused, name, label }: TabIconProps) {
  return (
    <View className="items-center pt-1" style={{ width: 64 }}>
      <Ionicons name={name} size={22} color={focused ? '#821A52' : '#9CA3AF'} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ fontSize: 11, marginTop: 2 }}
        className={focused ? 'text-primary-500 font-semibold' : 'text-gray-400'}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          height: 80,
          paddingBottom: 16,
          paddingTop: 4,
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
        name="visitors"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name={focused ? 'people' : 'people-outline'} label="Visitors" />
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
    </Tabs>
  );
}
