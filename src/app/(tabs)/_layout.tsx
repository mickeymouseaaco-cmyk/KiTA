import { Tabs } from 'expo-router/js-tabs';
import { HeartHandshake, House, Mail, Plane, Users } from 'lucide-react-native';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { fonts, useTheme } from '@/theme';

/** Wide screens (tablets, computers) get a sidebar instead of a bottom bar. */
const SIDEBAR_FROM = 900;

/**
 * Four tabs: Home · Notes · Together · Trips. "Their day" is still a page of its
 * own (/their-day), reached from the My day / partner switch on Home, so every
 * old link keeps working.
 */
export default function TabsLayout() {
  const { c, look } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sidebar = width >= SIDEBAR_FROM;
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        animation: look.flat ? 'fade' : 'none',
        tabBarActiveBackgroundColor: sidebar ? c.primarySoft : undefined,
        tabBarLabelStyle: look.systemFont ? { fontFamily: 'System', fontWeight: '600', fontSize: sidebar ? 15 : 11 } : { fontFamily: fonts.bodySemi, fontSize: sidebar ? 15 : 12 },
        tabBarPosition: sidebar ? 'left' : 'bottom',
        tabBarVariant: sidebar ? 'material' : 'uikit',
        tabBarStyle: sidebar
          ? { backgroundColor: look.flat ? c.bg : c.surface, borderRightColor: c.border, minWidth: 220, paddingTop: 24 }
          : {
              backgroundColor: look.flat ? c.bg : c.surface,
              borderTopColor: c.border,
              height: 72 + insets.bottom,
              paddingTop: 6,
              paddingBottom: Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 12),
            },
        tabBarItemStyle: sidebar ? { borderRadius: 14, marginHorizontal: 12, marginVertical: 2 } : undefined,
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <House color={color} size={24} strokeWidth={look.flat ? (focused ? 2.4 : 1.7) : 2} /> }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes', tabBarIcon: ({ color, focused }) => <Mail color={color} size={24} strokeWidth={look.flat ? (focused ? 2.4 : 1.7) : 2} /> }} />
      <Tabs.Screen name="together" options={{ title: 'Together', tabBarIcon: ({ color, focused }) => <Users color={color} size={24} strokeWidth={look.flat ? (focused ? 2.4 : 1.7) : 2} /> }} />
      <Tabs.Screen name="trip" options={{ title: 'Trips', tabBarIcon: ({ color, focused }) => <Plane color={color} size={24} strokeWidth={look.flat ? (focused ? 2.4 : 1.7) : 2} /> }} />
      {/* Not in the bar (opened from the switch on Home), but still a normal page, so /their-day links work. */}
      <Tabs.Screen
        name="their-day"
        options={{ title: 'Their day', tabBarItemStyle: { display: 'none' }, tabBarIcon: ({ color }) => <HeartHandshake color={color} size={24} /> }}
      />
    </Tabs>
  );
}
