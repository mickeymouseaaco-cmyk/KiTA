/**
 * "Any gossip today?" — a little glass pop-up the first time you open KiTA
 * each day. Type it, or record a quick video, and it goes straight to your
 * partner as a surat cinta.
 * Easy to wave away, and it won't come back until tomorrow.
 */
import { Coffee, Film, Send, Video, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { pickVideo, queueVideoNote, type PickedVideo } from '@/lib/compose';
import { gentleError } from '@/lib/copy';
import { dayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { sendText } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { space, useTheme, vivid } from '@/theme';

import { Button, Row, T } from './ui';
import { glassStyle, tintOf } from './widgets';

const KEY = 'kita.gossip.asked';
const ND = Platform.OS !== 'web';

/** Has today's pop-up already been shown on this device? (Automated tests skip it unless they ask with ?gossip=1.) */
function alreadyAsked(today: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const forced = window.location?.search?.includes('gossip=1');
    if (!forced && typeof navigator !== 'undefined' && navigator.webdriver) return true;
    if (forced) return false;
    return window.localStorage?.getItem(KEY) === today;
  } catch {
    return false;
  }
}

function markAsked(today: string) {
  try {
    window.localStorage?.setItem(KEY, today);
  } catch {
    // Private browsing: it may ask again next time, which is fine.
  }
}

export function GossipPrompt() {
  const { c, dark, motion } = useTheme();
  const who = usePaired();
  const { toast, ensurePermission } = useFeedback();
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [today] = useState(() => dayKey(new Date()));
  const [open, setOpen] = useState(() => !alreadyAsked(today));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [rise] = useState(() => new Animated.Value(motion === 'off' ? 1 : 0));

  useEffect(() => {
    if (!open || motion === 'off') return;
    Animated.timing(rise, { toValue: 1, duration: 320, delay: 350, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: ND }).start();
  }, [open, motion, rise]);

  function close() {
    markAsked(today);
    setOpen(false);
  }

  async function addVideo(source: 'camera' | 'library') {
    if (source === 'camera' && !(await ensurePermission('camera'))) return;
    if (source === 'camera' && !(await ensurePermission('microphone'))) return;
    if (source === 'library' && !(await ensurePermission('photos'))) return;
    try {
      const v = await pickVideo(source);
      if (v === 'too-long') toast('Videos can be up to 60 seconds. Could you keep it a little shorter?');
      else if (v) {
        haptic.tap();
        setVideo(v);
      }
    } catch {
      toast('We couldn’t open the camera. Let’s try again.');
    }
  }

  async function send() {
    const t = text.trim();
    if (!t && !video) return;
    setSending(true);
    try {
      // A video goes up in the background (it keeps trying, even offline); text goes at once.
      if (video) await queueVideoNote(who, video, t ? `☕ ${t}` : '☕ Gossip!', { allowSave: true });
      else await sendText(who, `☕ ${t}`, 'text', {});
      haptic.success();
      toast(`Sent to ${who.partnerName}. Spill more in Surat Cinta.`);
      close();
    } catch {
      toast(gentleError.send);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;
  const accent = tintOf('pink', dark);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Not now" onPress={close} style={{ flex: 1, backgroundColor: dark ? 'rgba(0,0,0,0.45)' : 'rgba(40,30,60,0.22)', justifyContent: 'center', padding: space.lg }}>
          <Animated.View
            style={{
              opacity: rise,
              transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
              alignSelf: 'center',
              width: '100%',
              maxWidth: 400,
            }}>
            {/* Taps inside the card don't close it. */}
            <Pressable
              testID="gossip-prompt"
              accessibilityViewIsModal
              onPress={() => {}}
              style={[
                glassStyle(dark),
                {
                  backgroundColor: dark ? 'rgba(34,32,44,0.88)' : 'rgba(255,255,255,0.9)',
                  borderRadius: 30,
                  borderCurve: 'continuous',
                  padding: space.lg,
                  gap: space.md,
                  borderWidth: 1,
                  borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.95)',
                  boxShadow: '0px 24px 60px rgba(40,20,70,0.28)',
                  overflow: 'hidden',
                },
              ]}>
              <View style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: vivid.pink[0], opacity: dark ? 0.16 : 0.22 }} />
              <View style={{ position: 'absolute', bottom: -70, left: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: vivid.violet[0], opacity: dark ? 0.12 : 0.16 }} />
              <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${vivid.pink[0]}33` }}>
                <Coffee color={accent} size={26} strokeWidth={2.2} />
              </View>
              <View style={{ gap: 4 }}>
                <T variant="title" style={{ fontSize: 26, lineHeight: 31 }}>
                  Any gossip today?
                </T>
                <T variant="body" muted>
                  Tell me… it goes straight to {who.partnerName}.
                </T>
              </View>
              {video ? (
                <Row
                  testID="gossip-video"
                  gap={space.sm}
                  style={{ padding: 10, borderRadius: 18, backgroundColor: `${vivid.pink[0]}26`, borderWidth: 1, borderColor: `${vivid.pink[0]}55` }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: accent }}>
                    <Film color="#FFFFFF" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">Video ready</T>
                    <T variant="small" muted style={{ fontSize: 13, lineHeight: 17 }}>
                      {`0:${String(Math.min(59, Math.max(1, Math.round(video.durationMs / 1000)))).padStart(2, '0')}`} · add a caption if you like
                    </T>
                  </View>
                  <Pressable testID="gossip-video-remove" accessibilityRole="button" accessibilityLabel="Remove the video" hitSlop={8} onPress={() => setVideo(null)} style={{ padding: 6 }}>
                    <X color={c.textMuted} size={20} />
                  </Pressable>
                </Row>
              ) : (
                <Row gap={space.sm}>
                  <Pressable
                    testID="gossip-record"
                    accessibilityRole="button"
                    accessibilityLabel="Record a video"
                    onPress={() => addVideo('camera')}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 16, backgroundColor: `${vivid.pink[0]}26`, borderWidth: 1, borderColor: `${vivid.pink[0]}55` }}>
                    <Video color={accent} size={19} strokeWidth={2.3} />
                    <T variant="bodyStrong" color={accent}>
                      Record video
                    </T>
                  </Pressable>
                  <Pressable
                    testID="gossip-pick-video"
                    accessibilityRole="button"
                    accessibilityLabel="Choose a video"
                    onPress={() => addVideo('library')}
                    style={{ minHeight: 46, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }}>
                    <Film color={c.textMuted} size={19} />
                  </Pressable>
                </Row>
              )}
              <TextInput
                testID="gossip-text"
                value={text}
                onChangeText={setText}
                placeholder={video ? 'Add a caption…' : 'Or type it: so guess what happened…'}
                placeholderTextColor={c.textMuted}
                multiline
                maxLength={1000}
                autoFocus={Platform.OS !== 'web'}
                style={{
                  minHeight: video ? 52 : 80,
                  maxHeight: 160,
                  borderRadius: 18,
                  paddingHorizontal: space.md,
                  paddingVertical: 12,
                  fontSize: 16,
                  color: c.text,
                  backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
                  borderWidth: 1,
                  borderColor: c.border,
                  textAlignVertical: 'top',
                }}
              />
              <Row gap={space.sm}>
                <View style={{ flex: 1 }}>
                  <Button testID="gossip-later" kind="ghost" label="Not now" onPress={close} />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Button testID="gossip-send" icon={Send} label="Tell me" disabled={(!text.trim() && !video) || sending} hint="Type or record your gossip first" onPress={send} />
                </View>
              </Row>
            </Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
