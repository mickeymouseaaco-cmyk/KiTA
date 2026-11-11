import { Tabs } from 'expo-router/js-tabs';
import { HeartHandshake, House, Mail, Plane, Users } from 'lucide-react-native';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { useStatuses } from '@/lib/status';
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
  // Unopened notes from my partner (statuses included) as a number on Notes, like WhatsApp.
  const { cid, uid, partnerId } = useSession();
  const { unreadNotes } = useStatuses(cid, uid, partnerId);
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        animation: look.flat ? 'fade' : 'none',
        tabBarActiveBackgroundColor: sidebar ? c.primarySoft : undefined,
        tabBarLabelStyle: look.systemFont ? { fontFamily: 'System', fontWeight: '600', fontSize: sidebar ? 15 : 10, lineHeight: sidebar ? undefined : 13 } : { fontFamily: fonts.bodySemi, fontSize: sidebar ? 15 : 10.5, lineHeight: sidebar ? undefined : 13 },
        tabBarPosition: sidebar ? 'left' : 'bottom',
        tabBarVariant: sidebar ? 'material' : 'uikit',
        tabBarStyle: sidebar
          ? { backgroundColor: look.flat ? c.bg : c.surface, borderRightColor: c.border, minWidth: 220, paddingTop: 24 }
          : {
              backgroundColor: look.flat ? c.bg : c.surface,
              borderTopColor: c.border,
              height: 54 + Math.max(insets.bottom, 6),
              paddingTop: 4,
              paddingBottom: Math.max(insets.bottom, 6),
            },
        tabBarItemStyle: sidebar ? { borderRadius: 14, marginHorizontal: 12, marginVertical: 2 } : undefined,
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <House color={color} size={22} strokeWidth={look.flat ? (focused ? 2.4 : 1.7) : 2} /> }} />
      {/* Notes takes the whole screen on phones (like a chat); its own back arrow returns Home. */}
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarBadge: unreadNotes ? (unreadNotes > 99 ? '99+' : unreadNotes) : undefined,
          tabBarBadgeStyle: { backgroundColor: c.heart, color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
          tabBarIcon: ({ color, focused }) => <Mail color={color} size={22} strokeWidth={look.flat ? (focused ? 2.4 : 1.7) : 2} />,
          ...(sidebar ? null : { tabBarStyle: { display: 'none' } }),
        }}
      />
      <Tabs.Screen name="together" options={{ title: 'Together', tabBarIcon: ({ color, focused }) => <Users color={color} size={22} strokeWidth={look.flat ? (focused ? 2.4 : 1.7) : 2} /> }} />
      <Tabs.Screen name="trip" options={{ title: 'Trips', tabBarIcon: ({ color, focused }) => <Plane color={color} size={22} strokeWidth={look.flat ? (focused ? 2.4 : 1.7) : 2} /> }} />
      {/* Not in the bar (opened from the switch on Home), but still a normal page, so /their-day links work. */}
      <Tabs.Screen
        name="their-day"
        options={{ title: 'Their day', tabBarItemStyle: { display: 'none' }, tabBarIcon: ({ color }) => <HeartHandshake color={color} size={24} /> }}
      />
    </Tabs>
  );
}
