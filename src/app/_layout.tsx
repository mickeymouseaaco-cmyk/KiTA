import { Lora_500Medium, Lora_600SemiBold } from '@expo-google-fonts/lora';
import { Raleway_500Medium, Raleway_600SemiBold, Raleway_700Bold } from '@expo-google-fonts/raleway';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, usePathname, useSegments, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { RefreshCw, House, TriangleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CelebrateProvider } from '@/components/celebrate';
import { FeedbackProvider } from '@/components/feedback';
import { IncomingLove, LockScreen, SurpriseWatcher } from '@/components/overlays';
import { LocationSync } from '@/components/location-sync';
import { WebPushSync } from '@/components/web-push-row';
import { AppearanceSync } from '@/lib/appearance';
import { installErrorReporting, reportError, setErrorRoute } from '@/lib/errors';
import { LockProvider } from '@/lib/lock';
import { configureNotifications } from '@/lib/notifications';
import { outbox } from '@/lib/outbox';
import { SessionProvider, useSession } from '@/lib/session';
import { Button, T } from '@/components/ui';
import { TogetherThemeProvider, space, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Send people to the right place for where they are: sign in, pair, or home. */
function Gate() {
  const { status, uid } = useSession();
  const segments = useSegments();
  const pathname = usePathname();

  // So an error report can say which screen it came from.
  useEffect(() => setErrorRoute(pathname), [pathname]);

  useEffect(() => {
    if (status === 'loading') return;
    SplashScreen.hideAsync().catch(() => {});
    const first = segments[0] as string | undefined;
    // The privacy policy and terms can always be read, signed in or not.
    const open = first === 'privacy-policy' || first === 'terms';
    if (status === 'unconfigured' && first !== 'setup') router.replace('/setup');
    else if (status === 'signedOut' && first !== 'sign-in' && !open) router.replace('/sign-in');
    else if (status === 'needsPair' && first !== 'pair' && first !== 'settings' && !open) router.replace('/pair');
    else if (status === 'paired' && (first === 'sign-in' || first === 'pair' || first === 'setup' || first === undefined)) {
      router.replace('/(tabs)');
    }
  }, [status, segments]);

  // Resume any media still waiting to send.
  useEffect(() => {
    if (!uid) return;
    outbox.load().then(() => outbox.kick(uid));
  }, [uid]);

  return null;
}

function Navigator() {
  const { c, dark, look } = useTheme();
  const headerBg = look.name === 'professional' || look.flat ? c.bg : c.primarySoft;
  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme : DefaultTheme).colors,
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.border,
      primary: c.primary,
      notification: c.heart,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: look.systemFont ? { fontFamily: 'System', fontWeight: '600', fontSize: 17, color: c.text } : { fontFamily: look.headingFont, fontSize: 20, color: c.text },
          headerTitleAlign: look.flat ? 'center' : 'left',
          headerTintColor: c.primary,
          contentStyle: { backgroundColor: c.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="pair" options={{ title: 'Connect with your partner', headerShown: false }} />
        <Stack.Screen name="log-steps" options={{ title: 'Steps', presentation: 'modal' }} />
        <Stack.Screen name="steps-sync" options={{ title: 'Steps from iPhone' }} />
        <Stack.Screen name="appearance" options={{ title: 'Look & feel' }} />
        <Stack.Screen name="question" options={{ title: 'Question of the day' }} />
        <Stack.Screen name="notes-media" options={{ title: 'Photos, videos & voice' }} />
        <Stack.Screen name="find" options={{ title: 'Find my partner' }} />
        <Stack.Screen name="log-mood" options={{ title: 'How are you?', presentation: 'modal' }} />
        <Stack.Screen name="vent" options={{ title: 'Vent', presentation: 'modal' }} />
        <Stack.Screen name="calm" options={{ title: 'Calm Corner' }} />
        <Stack.Screen name="stress-smash" options={{ title: 'Stress Smash', headerShown: false }} />
        <Stack.Screen name="flight" options={{ title: 'Flight' }} />
        <Stack.Screen name="cycle" options={{ title: 'Cycle' }} />
        <Stack.Screen name="check-in" options={{ title: 'Evening check-in', presentation: 'modal' }} />
        <Stack.Screen name="gratitude" options={{ title: 'Gratitude Wall' }} />
        <Stack.Screen name="mood-calendar" options={{ title: 'Our moods' }} />
        <Stack.Screen name="reset" options={{ title: 'A gentle reset' }} />
        <Stack.Screen name="storage" options={{ title: 'Storage' }} />
        <Stack.Screen name="vault" options={{ title: 'Private vault' }} />
        <Stack.Screen name="trip-new" options={{ title: 'New trip', presentation: 'modal' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen name="trip/slideshow" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="bucket-list" options={{ title: 'Our bucket list' }} />
        <Stack.Screen name="date-night" options={{ title: 'Date night ideas' }} />
        <Stack.Screen name="milestones" options={{ title: 'Milestones' }} />
        <Stack.Screen name="todos" options={{ title: 'Our to-dos' }} />
        <Stack.Screen name="weekend" options={{ title: 'This weekend' }} />
        <Stack.Screen name="weather" options={{ title: 'Weather' }} />
        <Stack.Screen name="schedule-note" options={{ title: 'Schedule a note', presentation: 'modal' }} />
        <Stack.Screen name="memory-new" options={{ title: 'New memory', presentation: 'modal' }} />
        <Stack.Screen name="memory/[id]" options={{ title: 'Memory' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="privacy" options={{ title: 'What they can see' }} />
        <Stack.Screen name="privacy-policy" options={{ title: 'Privacy' }} />
        <Stack.Screen name="terms" options={{ title: 'Terms' }} />
        <Stack.Screen name="status" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      <Gate />
      <AppearanceSync />
      <WebPushSync />
      <LocationSync />
      <IncomingLove />
      <SurpriseWatcher />
      <LockScreen />
      <StatusBarShade />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Lora_500Medium, Lora_600SemiBold, Raleway_500Medium, Raleway_600SemiBold, Raleway_700Bold });

  useEffect(() => {
    configureNotifications();
    installErrorReporting();
  }, []);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TogetherThemeProvider>
          <SessionProvider>
            <LockProvider>
              <FeedbackProvider>
                <CelebrateProvider>
                  <Navigator />
                </CelebrateProvider>
              </FeedbackProvider>
            </LockProvider>
          </SessionProvider>
        </TogetherThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * If a screen breaks, show a calm page instead of a blank one, note what went
 * wrong (no personal content) so it can be fixed, and offer a way back.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  useEffect(() => {
    reportError(error, 'crash');
  }, [error]);
  return (
    <View testID="error-screen" style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
        <TriangleAlert color={c.text} size={30} strokeWidth={1.7} />
      </View>
      <T variant="title" center>
        Something went wrong
      </T>
      <T muted center style={{ maxWidth: 320 }}>
        That’s on us, not you. We’ve noted it so it can be fixed, and your notes and logs are safe.
      </T>
      <View style={{ gap: space.sm, width: '100%', maxWidth: 320, marginTop: space.sm }}>
        <Button testID="error-retry" icon={RefreshCw} label="Try again" onPress={() => retry()} />
        <Button kind="ghost" icon={House} label="Go to Home" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

/**
 * On iPhone (added to the Home Screen) KiTA draws under the clock and Dynamic
 * Island, and iOS shows the clock in white there. In light mode a soft shade
 * behind it keeps the time and battery readable; in dark mode none is needed.
 */
function StatusBarShade() {
  const { c, dark } = useTheme();
  const { top } = useSafeAreaInsets();
  // The page behind the app takes the app's own background, so no edge of the
  // screen ever shows a different-coloured strip (light or dark, any look).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = c.bg;
    document.body.style.backgroundColor = c.bg;
  }, [c.bg]);
  if (Platform.OS !== 'web' || dark || top < 20) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top + 10, pointerEvents: 'none', zIndex: 1000 }}>
      <Svg width="100%" height={top + 10}>
        <Defs>
          <LinearGradient id="status-shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.32" />
            <Stop offset="0.7" stopColor="#000000" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={top + 10} fill="url(#status-shade)" />
      </Svg>
    </View>
  );
}
