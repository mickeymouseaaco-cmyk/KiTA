/**
 * Gentle feedback: soft toasts (never red, never alarming) and kind permission
 * primers shown before the system permission dialog.
 */
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Bell, Image as ImageIcon, Mic, type LucideIcon } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { permissionCopy } from '@/lib/copy';
import { notificationStatus } from '@/lib/notifications';
import { motion, radius, space, useTheme } from '@/theme';

import { Button, Gap, T } from './ui';

type PermissionKind = 'camera' | 'photos' | 'microphone' | 'notifications';

type Feedback = {
  toast: (text: string) => void;
  /** Show our primer if the OS hasn't asked yet; then ask the OS. Resolves true if granted. */
  ensurePermission: (kind: PermissionKind) => Promise<boolean>;
};

const FeedbackContext = createContext<Feedback | null>(null);

const ICONS: Record<PermissionKind, LucideIcon> = { camera: Camera, photos: ImageIcon, microphone: Mic, notifications: Bell };

async function osStatus(kind: PermissionKind): Promise<'granted' | 'denied' | 'undetermined'> {
  switch (kind) {
    case 'camera':
      return (await ImagePicker.getCameraPermissionsAsync()).status as never;
    case 'photos':
      return (await ImagePicker.getMediaLibraryPermissionsAsync()).status as never;
    case 'microphone':
      return (await getRecordingPermissionsAsync()).status as never;
    case 'notifications':
      return notificationStatus();
  }
}

async function osRequest(kind: PermissionKind): Promise<boolean> {
  switch (kind) {
    case 'camera':
      return (await ImagePicker.requestCameraPermissionsAsync()).granted;
    case 'photos':
      return (await ImagePicker.requestMediaLibraryPermissionsAsync()).granted;
    case 'microphone':
      return (await requestRecordingPermissionsAsync()).granted;
    case 'notifications':
      return true; // the caller registers (which requests) after the primer
  }
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [toastText, setToastText] = useState<string | null>(null);
  const [fade] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [primer, setPrimer] = useState<{ kind: PermissionKind; resolve: (ok: boolean) => void } | null>(null);
  const [deniedKind, setDeniedKind] = useState<PermissionKind | null>(null);

  const toast = useCallback(
    (text: string) => {
      setToastText(text);
      Animated.timing(fade, { toValue: 1, duration: motion.base, useNativeDriver: Platform.OS !== 'web' }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: motion.base, useNativeDriver: Platform.OS !== 'web' }).start(() =>
          setToastText(null),
        );
      }, 2600);
    },
    [fade],
  );

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const ensurePermission = useCallback(async (kind: PermissionKind) => {
    if (Platform.OS === 'web' && kind !== 'microphone') return true;
    let status: 'granted' | 'denied' | 'undetermined';
    try {
      status = await osStatus(kind);
    } catch {
      status = 'undetermined';
    }
    if (status === 'granted') return true;
    if (status === 'denied') {
      setDeniedKind(kind);
      return false;
    }
    const agreed = await new Promise<boolean>((resolve) => setPrimer({ kind, resolve }));
    if (!agreed) return false;
    const granted = await osRequest(kind).catch(() => false);
    if (!granted) setDeniedKind(kind);
    return granted;
  }, []);

  const close = (ok: boolean) => {
    primer?.resolve(ok);
    setPrimer(null);
  };

  const PrimerIcon = primer ? ICONS[primer.kind] : Bell;

  return (
    <FeedbackContext.Provider value={{ toast, ensurePermission }}>
      {children}

      {toastText ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            { top: insets.top + 64, backgroundColor: c.text, opacity: fade },
          ]}>
          <T color={c.bg} center>
            {toastText}
          </T>
        </Animated.View>
      ) : null}

      <Modal visible={!!primer || !!deniedKind} transparent animationType="fade" onRequestClose={() => (primer ? close(false) : setDeniedKind(null))}>
        <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + space.xl }]}>
            <View style={[styles.iconCircle, { backgroundColor: c.primarySoft }]}>
              <PrimerIcon color={c.primary} size={28} />
            </View>
            {primer ? (
              <>
                <T variant="title" center accessibilityRole="header">
                  {permissionCopy[primer.kind].title}
                </T>
                <Gap h={space.sm} />
                <T muted center>
                  {permissionCopy[primer.kind].body}
                </T>
                <Gap h={space.xl} />
                <Button label="Continue" onPress={() => close(true)} />
                <Gap h={space.sm} />
                <Button label="Not now" kind="ghost" onPress={() => close(false)} />
              </>
            ) : (
              <>
                <T muted center>
                  {permissionCopy.denied}
                </T>
                <Gap h={space.xl} />
                {Platform.OS !== 'web' ? (
                  <>
                    <Button
                      label="Open settings"
                      onPress={() => {
                        setDeniedKind(null);
                        Linking.openSettings().catch(() => {});
                      }}
                    />
                    <Gap h={space.sm} />
                  </>
                ) : null}
                <Button label="Okay" kind="ghost" onPress={() => setDeniedKind(null)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider');
  return ctx;
}

/** A soft backdrop-dismissable bottom sheet. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        {/* The backdrop is a sibling, not a wrapper, so gestures inside the sheet
            (like hold-to-record) are never intercepted by it. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + space.xl }]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    alignSelf: 'center',
    maxWidth: 480,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    padding: space.xl,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: space.lg,
  },
});
