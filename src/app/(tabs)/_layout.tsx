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
  const { c } = useTheme();
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
        tabBarActiveBackgroundColor: sidebar ? c.primarySoft : undefined,
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: sidebar ? 15 : 12 },
        tabBarPosition: sidebar ? 'left' : 'bottom',
        tabBarVariant: sidebar ? 'material' : 'uikit',
        tabBarStyle: sidebar
          ? { backgroundColor: c.surface, borderRightColor: c.border, minWidth: 220, paddingTop: 24 }
          : {
              backgroundColor: c.surface,
              borderTopColor: c.border,
              height: 72 + insets.bottom,
              paddingTop: 6,
              paddingBottom: Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 12),
            },
        tabBarItemStyle: sidebar ? { borderRadius: 14, marginHorizontal: 12, marginVertical: 2 } : undefined,
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <House color={color} size={24} /> }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes', tabBarIcon: ({ color }) => <Mail color={color} size={24} /> }} />
      <Tabs.Screen name="together" options={{ title: 'Together', tabBarIcon: ({ color }) => <Users color={color} size={24} /> }} />
      <Tabs.Screen name="trip" options={{ title: 'Trips', tabBarIcon: ({ color }) => <Plane color={color} size={24} /> }} />
      {/* Not in the bar: opened from the switch on Home. */}
      <Tabs.Screen name="their-day" options={{ href: null, title: 'Their day', tabBarIcon: ({ color }) => <HeartHandshake color={color} size={24} /> }} />
    </Tabs>
  );
}
