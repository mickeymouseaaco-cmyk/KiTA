import { Tabs } from 'expo-router/js-tabs';
import { HeartHandshake, Mail, Plane, Sun, Users } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { fonts, useTheme } from '@/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 72 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 12),
        },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => <Sun color={color} size={24} /> }} />
      <Tabs.Screen
        name="their-day"
        options={{ title: 'Their Day', tabBarIcon: ({ color }) => <HeartHandshake color={color} size={24} /> }}
      />
      <Tabs.Screen name="notes" options={{ title: 'Love Notes', tabBarIcon: ({ color }) => <Mail color={color} size={24} /> }} />
      <Tabs.Screen name="together" options={{ title: 'Together', tabBarIcon: ({ color }) => <Users color={color} size={24} /> }} />
      <Tabs.Screen name="trip" options={{ title: 'Trip', tabBarIcon: ({ color }) => <Plane color={color} size={24} /> }} />
    </Tabs>
  );
}
