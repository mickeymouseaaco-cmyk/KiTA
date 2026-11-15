/**
 * "Any gossip today?" — a little glass pop-up the first time you open KiTA
 * each day. Type it, or record a quick video, and it goes straight to your
 * partner as a surat cinta.
 * Easy to wave away, and it won't come back until tomorrow.
 */
import { Check, Send, Video, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { pickVideo, queueVideoNote, type PickedVideo } from '@/lib/compose';
import { gentleError } from '@/lib/copy';
import { dayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { sendText } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { space, useTheme } from '@/theme';

import { Row, T } from './ui';

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
    // On the web the phone's own camera screen asks for permission itself.
    if (Platform.OS !== 'web') {
      if (source === 'camera' && !(await ensurePermission('camera'))) return;
      if (source === 'camera' && !(await ensurePermission('microphone'))) return;
      if (source === 'library' && !(await ensurePermission('photos'))) return;
    }
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
  const has = !!text.trim() || !!video;
  const red = '#FF375F';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Not now" onPress={close} style={{ flex: 1, backgroundColor: dark ? 'rgba(0,0,0,0.6)' : 'rgba(20,16,30,0.35)', justifyContent: 'center', padding: space.lg }}>
          <Animated.View
            style={{
              opacity: rise,
              transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
              alignSelf: 'center',
              width: '100%',
              maxWidth: 380,
            }}>
            {/* Taps inside the card don't close it. */}
            <Pressable
              testID="gossip-prompt"
              accessibilityViewIsModal
              onPress={() => {}}
              style={{
                backgroundColor: dark ? '#1C1B22' : '#FFFFFF',
                borderRadius: 34,
                borderCurve: 'continuous',
                paddingHorizontal: space.lg,
                paddingTop: space.xl,
                paddingBottom: space.lg,
                gap: space.lg,
                alignItems: 'stretch',
                borderWidth: dark ? 1 : 0,
                borderColor: 'rgba(255,255,255,0.08)',
                boxShadow: '0px 30px 70px rgba(10,5,25,0.35)',
              }}>
              <Pressable
                testID="gossip-close"
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                onPress={close}
                style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
                <X color={c.textMuted} size={17} strokeWidth={2.4} />
              </Pressable>

              <View style={{ alignItems: 'center', gap: 6 }}>
                <T variant="title" style={{ fontSize: 26, lineHeight: 31, textAlign: 'center' }}>
                  Any gossip today?
                </T>
                <T variant="body" muted style={{ textAlign: 'center' }}>
                  Tell me… it goes straight to {who.partnerName}.
                </T>
              </View>

              {/* One big round button: tap to record. */}
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Pressable
                  testID={video ? 'gossip-video' : 'gossip-record'}
                  accessibilityRole="button"
                  accessibilityLabel={video ? 'Video ready. Tap to record again' : 'Record a video'}
                  onPress={() => addVideo('camera')}
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                  <View style={{ width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: video ? '#34C759' : `${red}55`, alignItems: 'center', justifyContent: 'center' }}>
                    <View
                      style={{
                        width: 92,
                        height: 92,
                        borderRadius: 46,
                        backgroundColor: video ? '#34C759' : red,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        boxShadow: `0px 10px 24px ${video ? 'rgba(52,199,89,0.4)' : 'rgba(255,55,95,0.45)'}`,
                      }}>
                      {video ? <Check color="#FFFFFF" size={30} strokeWidth={3} /> : <Video color="#FFFFFF" size={26} strokeWidth={2.4} />}
                      <T variant="bodyStrong" color="#FFFFFF" style={{ fontSize: 15, lineHeight: 19 }}>
                        {video ? `0:${String(Math.min(59, Math.max(1, Math.round(video.durationMs / 1000)))).padStart(2, '0')}` : 'Record'}
                      </T>
                    </View>
                  </View>
                </Pressable>
                {video ? (
                  <Row gap={6}>
                    <T variant="small" muted style={{ fontSize: 13, lineHeight: 17 }}>
                      Video ready · tap to retake ·
                    </T>
                    <Pressable testID="gossip-video-remove" accessibilityRole="button" accessibilityLabel="Remove the video" hitSlop={8} onPress={() => setVideo(null)}>
                      <T variant="small" color={red} style={{ fontSize: 13, lineHeight: 17, fontWeight: '600' }}>
                        Remove
                      </T>
                    </Pressable>
                  </Row>
                ) : null}
              </View>

              <TextInput
                testID="gossip-text"
                value={text}
                onChangeText={setText}
                placeholder={video ? 'Add a caption…' : 'Or type it: so guess what happened…'}
                placeholderTextColor={c.textMuted}
                multiline
                maxLength={1000}
                style={{
                  minHeight: video ? 52 : 80,
                  maxHeight: 160,
                  borderRadius: 20,
                  borderCurve: 'continuous',
                  paddingHorizontal: space.md,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: c.text,
                  backgroundColor: dark ? 'rgba(255,255,255,0.06)' : '#F4F3F7',
                  textAlignVertical: 'top',
                }}
              />

              {has ? (
                <Pressable
                  testID="gossip-send"
                  accessibilityRole="button"
                  accessibilityLabel={`Send to ${who.partnerName}`}
                  disabled={sending}
                  onPress={send}
                  style={({ pressed }) => ({
                    minHeight: 54,
                    borderRadius: 27,
                    backgroundColor: c.text,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: sending ? 0.6 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}>
                  <Send color={c.bg} size={18} strokeWidth={2.4} />
                  <T variant="bodyStrong" color={c.bg}>
                    {sending ? 'Sending…' : `Tell ${who.partnerName}`}
                  </T>
                </Pressable>
              ) : (
                <Pressable testID="gossip-later" accessibilityRole="button" onPress={close} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <T variant="bodyStrong" muted>
                    Not now
                  </T>
                </Pressable>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
