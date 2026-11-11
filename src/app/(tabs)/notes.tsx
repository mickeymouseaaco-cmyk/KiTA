import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { CalendarClock, Camera, Check, ChevronLeft, Clock, ListFilter, Copy, Gift, Heart, ImagePlus, Images, ListTodo, Mail, Mic, Plus, Send, Star, Trash, Video, X, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCelebrate } from '@/components/celebrate';
import { Sheet, useFeedback } from '@/components/feedback';
import { MediaById } from '@/components/media-view';
import { OutboxRow, useOutbox } from '@/components/outbox-row';
import { NoteMedia, ViewOnceNote } from '@/components/rich-media';
import { Button, EmptyState, Gap, IconButton, Row, Segmented, T, ToggleRow, useInputStyle } from '@/components/ui';
import { VoiceRecorder, type Recording } from '@/components/voice';
import { empty, gentleError } from '@/lib/copy';
import { pickPhoto, pickVideo, queuePhotoNote, queueVideoNote, queueVoiceNote, type NoteOptions, type PickedVideo } from '@/lib/compose';
import { relativeTime } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { showTimeFlags } from '@/lib/note-groups';
import { LIMITS, type PreparedImage } from '@/lib/media';
import { deleteMessage, isFaded, markRead, sendText, starredNotes, toggleFavorite, toggleImportant, useMessages } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { usePartnerTyping, useTypingSignal } from '@/lib/typing';
import { cancelScheduled, openSurprise, toggleScheduledFavorite, useDeliveredToMe, useMyScheduled, type ScheduledNote } from '@/lib/together-data';
import { addTodo, dueDateFor, useTodos } from '@/lib/todos';
import type { Message } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

type Draft =
  | { kind: 'photo'; photo: PreparedImage }
  | { kind: 'video'; video: PickedVideo }
  | { kind: 'voice'; hug: boolean }
  | { kind: 'video-source' };

const NO_OPTIONS: NoteOptions = { allowSave: false, viewOnce: false, disappearing: false };

/** Privacy choices for a photo, video or voice note. */
function PrivacyOptions({ value, onChange, partnerName }: { value: NoteOptions; onChange: (o: NoteOptions) => void; partnerName: string }) {
  return (
    <View>
      <ToggleRow
        testID="opt-view-once"
        title="View once"
        detail={`${partnerName} can open it one time, then it’s gone.`}
        value={!!value.viewOnce}
        onChange={(v) => onChange({ ...value, viewOnce: v, allowSave: v ? false : value.allowSave })}
      />
      <ToggleRow
        testID="opt-disappearing"
        title="Disappears after 24 hours"
        value={!!value.disappearing}
        onChange={(v) => onChange({ ...value, disappearing: v })}
      />
      {!value.viewOnce ? (
        <ToggleRow title={`Let ${partnerName} save it to their phone`} value={value.allowSave} onChange={(v) => onChange({ ...value, allowSave: v })} />
      ) : null}
    </View>
  );
}

/** One choice in the long-press sheet. */
function OptionRow({ icon: Icon, label, onPress, testID, quiet }: { icon: LucideIcon; label: string; onPress: () => void; testID?: string; quiet?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center', backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
      <Row gap={space.md}>
        <Icon color={quiet ? c.textMuted : c.primary} size={22} />
        <T variant="bodyStrong" color={quiet ? c.textMuted : c.text}>
          {label}
        </T>
      </Row>
    </Pressable>
  );
}

/** The note box starts one line tall and grows to about six lines. */
const COMPOSER_MIN = 44;
const COMPOSER_MAX = 160;

export default function LoveNotes() {
  const { c } = useTheme();
  const input = useInputStyle();
  const who = usePaired();
  const { uid, cid, partnerName } = who;
  // On phones the bottom bar is hidden here, so the notes get the whole screen.
  const fullScreen = useWindowDimensions().width < 900;
  const typing = useTypingSignal(cid, uid);
  const partnerTyping = usePartnerTyping(cid, who.partnerId);
  const { toast, ensurePermission } = useFeedback();
  const params = useLocalSearchParams<{ compose?: string }>();
  const { messages, ready, error } = useMessages(cid);
  const pending = useOutbox((j) => j.uid === uid && j.cid === cid && j.target.kind === 'message');
  const [filter, setFilter] = useState<'all' | 'starred' | 'saved'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [text, setText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [inputH, setInputH] = useState(COMPOSER_MIN);
  const [important, setImportant] = useState(false);
  const { todos } = useTodos(cid);
  const todoFrom = new Set(todos.map((t) => t.fromMessageId).filter(Boolean));
  const [draftState, setDraftState] = useState<Draft | null>(null);
  // Opened from "Record a voice hug" on Their Day.
  const draft: Draft | null = draftState ?? (params.compose === 'voiceHug' ? { kind: 'voice', hug: true } : null);
  const setDraft = (d: Draft | null) => {
    setDraftState(d);
    if (params.compose) router.setParams({ compose: undefined });
  };
  const [caption, setCaption] = useState('');
  const [opts, setOpts] = useState<NoteOptions>(NO_OPTIONS);
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null);
  const [optionsFor, setOptionsFor] = useState<Message | null>(null);

  // Quietly mark incoming notes as read while this screen is open.
  useFocusEffect(
    useCallback(() => {
      messages.filter((m) => m.toUid === uid && !m.readAt && m.createdAt).forEach((m) => markRead(cid, m).catch(() => {}));
    }, [messages, uid, cid]),
  );

  const visible = messages.filter((m) => !isFaded(m));
  const delivered = useDeliveredToMe(cid, uid);
  const mySched = useMyScheduled(cid, uid);
  const [now] = useState(() => Date.now());
  const waiting = mySched.filter((n) => n.deliverAt.toMillis() > now).sort((a, b) => a.deliverAt.toMillis() - b.deliverAt.toMillis());
  const feed: FeedItem[] = [
    ...visible.map((m) => ({ key: m.id, at: m.createdAt?.toMillis?.() ?? now, m })),
    ...delivered.map((n) => ({ key: `s-${n.id}`, at: n.deliverAt.toMillis(), s: n })),
    ...mySched.filter((n) => n.deliverAt.toMillis() <= now).map((n) => ({ key: `s-${n.id}`, at: n.deliverAt.toMillis(), s: n })),
  ].sort((a, b) => b.at - a.at);
  const shown =
    filter === 'saved'
      ? feed.filter((f) => (f.m ?? f.s)!.favoriteBy?.length)
      : filter === 'starred'
        ? feed.filter((f) => f.m?.important && !f.m.viewOnce)
        : feed;
  const pinned = starredNotes(visible).slice(0, 3);
  // One time per burst of notes (same person, within an hour).
  const timeFlags = showTimeFlags(shown.map((f) => ({ from: f.m ? f.m.fromUid : `scheduled-${f.key}`, at: f.at })));
  const flagFor = new Map(shown.map((f, i) => [f.key, timeFlags[i]]));

  async function noteToTodo(m: Message) {
    if (todoFrom.has(m.id)) return router.push('/todos');
    try {
      await addTodo(who, { text: m.text ?? '', forUid: 'both', dueDate: dueDateFor('week'), fromMessageId: m.id });
      haptic.success();
      toast('Added to your shared to-dos.');
    } catch {
      toast(gentleError.save);
    }
  }
  const [showWaiting, setShowWaiting] = useState(false);

  function open(d: Draft) {
    setCaption('');
    setOpts(NO_OPTIONS);
    setDraft(d);
  }

  async function sendTyped() {
    const body = text.trim();
    if (!body) return;
    const star = important;
    typing.stopped();
    setText('');
    setInputH(COMPOSER_MIN);
    setImportant(false);
    try {
      await sendText(who, body, 'text', { important: star });
      haptic.soft();
    } catch {
      setText(body);
      setImportant(star);
      toast(gentleError.send);
    }
  }

  async function startPhoto(source: 'camera' | 'library') {
    if (!(await ensurePermission(source === 'camera' ? 'camera' : 'photos'))) return;
    try {
      const photo = await pickPhoto(source);
      if (photo) open({ kind: 'photo', photo });
    } catch {
      toast('We couldn’t open that photo. Let’s try another.');
    }
  }

  async function startVideo(source: 'camera' | 'library') {
    setDraft(null);
    if (source === 'camera' && !(await ensurePermission('camera'))) return;
    if (source === 'camera' && !(await ensurePermission('microphone'))) return;
    if (source === 'library' && !(await ensurePermission('photos'))) return;
    try {
      const v = await pickVideo(source);
      if (v === 'too-long') toast('Videos can be up to 60 seconds. Could you trim it a little?');
      else if (v) open({ kind: 'video', video: v });
    } catch {
      toast('We couldn’t open that video. Let’s try another.');
    }
  }

  async function sendDraft() {
    const d = draft;
    setDraft(null);
    if (d?.kind === 'photo') await queuePhotoNote(who, d.photo, caption, opts);
    if (d?.kind === 'video') await queueVideoNote(who, d.video, caption, opts);
  }

  async function sendVoice(r: Recording) {
    if (draft?.kind !== 'voice') return;
    const hug = draft.hug;
    setDraft(null);
    await queueVoiceNote(who, r.uri, r.durationMs, hug, opts);
  }

  return (
    <SafeAreaView edges={fullScreen ? ['top', 'bottom'] : ['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={2} style={{ flexShrink: 1 }}>
              {fullScreen ? (
                <Pressable testID="notes-back" accessibilityRole="button" accessibilityLabel="Back to Home" onPress={() => router.navigate('/')} hitSlop={10} style={{ marginLeft: -8, padding: 4 }}>
                  <ChevronLeft color={c.text} size={30} strokeWidth={2.2} />
                </Pressable>
              ) : null}
              <T variant="display" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
                Love Notes
              </T>
            </Row>
            <Row gap={space.sm}>
              <IconButton
                testID="open-filter"
                icon={ListFilter}
                label={filter === 'all' ? 'Show starred or saved notes' : `Showing ${filter} notes. Change`}
                active={filter !== 'all'}
                onPress={() => setFilterOpen(true)}
              />
              <IconButton testID="open-media" icon={Images} label="Photos, videos and voice notes" onPress={() => router.push('/notes-media')} />
              <IconButton testID="open-schedule" icon={CalendarClock} label="Schedule a note or hide a surprise" onPress={() => router.push('/schedule-note')} />
            </Row>
          </Row>
          {waiting.length ? (
            <Pressable testID="waiting-toggle" accessibilityRole="button" onPress={() => setShowWaiting((v) => !v)}>
              <Row gap={space.sm} style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.md }}>
                <Gift color={c.primary} size={18} />
                <T style={{ flex: 1 }}>
                  {waiting.length} {waiting.length === 1 ? 'note is' : 'notes are'} waiting to be delivered
                </T>
                <T variant="small" color={c.primary}>
                  {showWaiting ? 'Hide' : 'See'}
                </T>
              </Row>
            </Pressable>
          ) : null}
          {showWaiting
            ? waiting.map((n) => (
                <Row key={n.id} gap={space.sm} style={{ paddingHorizontal: space.sm }}>
                  <T variant="small" style={{ flex: 1 }} numberOfLines={1}>
                    {n.surprise === 'none' ? '\u23F0' : '\uD83C\uDF81'} {n.text || (n.kind === 'photo' ? 'Photo' : 'Voice note')}
                  </T>
                  <T variant="small" muted>
                    {n.surprise === 'open' ? 'next open' : n.deliverAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </T>
                  <Pressable accessibilityRole="button" accessibilityLabel="Cancel this note" hitSlop={8} onPress={() => cancelScheduled(cid, n).catch(() => toast(gentleError.save))} style={{ padding: 6 }}>
                    <X color={c.textMuted} size={14} />
                  </Pressable>
                </Row>
              ))
            : null}
          {pinned.length && filter === 'all' ? (
            <Pressable
              testID="pinned-notes"
              accessibilityRole="button"
              accessibilityLabel={`${pinned.length} starred ${pinned.length === 1 ? 'note' : 'notes'} to remember. Tap to see all starred notes`}
              onPress={() => setFilter('starred')}
              style={{ backgroundColor: c.butter, borderRadius: radius.md, padding: space.md, gap: space.xs }}>
              <Row gap={space.sm}>
                <Star color={c.onButter} fill={c.onButter} size={16} />
                <T variant="bodyStrong" color={c.onButter} style={{ flex: 1 }}>
                  To remember
                </T>
                <T variant="small" color={c.onButter}>
                  See all
                </T>
              </Row>
              {pinned.map((m) => (
                <T key={m.id} testID="pinned-note" color={c.onButter} numberOfLines={1}>
                  {m.text || (m.kind === 'photo' ? 'A photo' : m.kind === 'video' ? 'A video' : m.kind === 'voice' ? 'A voice note' : 'A hug')}
                </T>
              ))}
            </Pressable>
          ) : null}
          {filter !== 'all' ? (
            <Row gap={space.sm} style={{ backgroundColor: filter === 'starred' ? c.butter : c.heartSoft, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md }}>
              {filter === 'starred' ? <Star color={c.onButter} fill={c.onButter} size={16} /> : <Heart color={c.heart} fill={c.heart} size={16} />}
              <T variant="bodyStrong" style={{ flex: 1 }} color={filter === 'starred' ? c.onButter : c.text}>
                {filter === 'starred' ? 'Starred notes' : 'Saved notes'}
              </T>
              <Pressable testID="filter-clear" accessibilityRole="button" accessibilityLabel="Show all notes" hitSlop={8} onPress={() => setFilter('all')} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                <T variant="small" color={filter === 'starred' ? c.onButter : c.primary} style={{ fontFamily: 'Raleway_600SemiBold' }}>
                  Show all
                </T>
              </Pressable>
            </Row>
          ) : null}
        </View>

        <FlatList
          testID="notes-list"
          inverted={shown.length > 0}
          data={shown}
          keyExtractor={(f) => f.key}
          contentContainerStyle={{ paddingHorizontal: space.md, paddingVertical: space.md, gap: 3, flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}
          ListHeaderComponent={
            shown.length > 0 && pending.length && filter === 'all' ? (
              <View style={{ gap: space.sm }}>
                {pending.map((j) => (
                  <OutboxRow key={j.id} job={j} />
                ))}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            ready ? (
              <View style={{ gap: space.md }}>
                {pending.map((j) => (
                  <OutboxRow key={j.id} job={j} />
                ))}
                <EmptyState
                  icon={filter === 'saved' ? Heart : filter === 'starred' ? Star : Mail}
                  line={error ? gentleError.load : filter === 'saved' ? empty.favorites : filter === 'starred' ? empty.starred : empty.notes}
                />
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <View style={{ paddingBottom: flagFor.get(item.key) ? 10 : 0 }}>
            {item.m ? (
              <Bubble
                m={item.m}
                showTime={flagFor.get(item.key) ?? true}
                mine={item.m.fromUid === uid}
                uid={uid}
                cid={cid}
                partnerName={partnerName}
                onOptions={() => {
                  haptic.tap();
                  setOptionsFor(item.m!);
                }}
              />
            ) : (
              <ScheduledBubble n={item.s!} uid={uid} cid={cid} partnerName={partnerName} />
            )}
            </View>
          )}
        />

        {partnerTyping ? <TypingLine name={partnerName} /> : null}

        <View style={{ borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, padding: space.md, gap: space.sm }}>
          {text.trim() ? (
            <Pressable
              testID="mark-important"
              accessibilityRole="switch"
              accessibilityLabel="Mark as important"
              accessibilityHint="Pins this note for both of you so it isn't forgotten"
              accessibilityState={{ checked: important }}
              onPress={() => {
                haptic.tap();
                setImportant((v) => !v);
              }}
              hitSlop={6}
              style={{ width: '100%', maxWidth: 560, alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}>
              <Row gap={6}>
                <Star color={important ? c.onButter : c.textMuted} fill={important ? c.onButter : 'transparent'} size={16} />
                <T variant="small" color={important ? c.onButter : c.textMuted}>
                  {important ? 'Important: pinned for you both' : 'Mark as important'}
                </T>
              </Row>
            </Pressable>
          ) : null}
          {attachOpen ? (
            <Row gap={space.lg} style={{ width: '100%', maxWidth: 560, alignSelf: 'center', justifyContent: 'space-around', paddingBottom: space.xs }}>
              <IconButton testID="attach-camera" icon={Camera} label="Camera" showLabel size={48} onPress={() => { setAttachOpen(false); startPhoto('camera'); }} />
              <IconButton testID="attach-photo" icon={ImagePlus} label="Photo" showLabel size={48} onPress={() => { setAttachOpen(false); startPhoto('library'); }} />
              <IconButton testID="attach-video" icon={Video} label="Video" showLabel size={48} onPress={() => { setAttachOpen(false); open({ kind: 'video-source' }); }} />
              <IconButton testID="attach-voice" icon={Mic} label="Voice" showLabel size={48} onPress={() => { setAttachOpen(false); open({ kind: 'voice', hug: false }); }} />
            </Row>
          ) : null}
          {/* Like the phone's own Messages: one + for attachments, a wide box that grows, then send. */}
          <Row gap={space.sm} style={{ width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'flex-end' }}>
            <IconButton
              testID="attach-toggle"
              icon={attachOpen ? X : Plus}
              label={attachOpen ? 'Close attachments' : 'Add a photo, video or voice note'}
              active={attachOpen}
              size={COMPOSER_MIN}
              onPress={() => setAttachOpen((v) => !v)}
            />
            <TextInput
              testID="note-input"
              value={text}
              onChangeText={(t) => {
                setText(t);
                typing.typed(t);
              }}
              onBlur={typing.stopped}
              onFocus={() => setAttachOpen(false)}
              placeholder={`Write to ${partnerName}…`}
              placeholderTextColor={c.textMuted}
              multiline
              maxLength={2000}
              scrollEnabled={inputH >= COMPOSER_MAX}
              onContentSizeChange={(e) => {
                // Web reports the full box height; phones report the text only.
                const h = e.nativeEvent.contentSize.height + (Platform.OS === 'web' ? 0 : 20);
                setInputH(Math.min(COMPOSER_MAX, Math.max(COMPOSER_MIN, Math.ceil(h))));
              }}
              style={[
                input,
                {
                  flex: 1,
                  minHeight: COMPOSER_MIN,
                  height: inputH,
                  maxHeight: COMPOSER_MAX,
                  paddingTop: 10,
                  paddingBottom: 10,
                  paddingHorizontal: space.lg,
                  borderRadius: 22,
                  backgroundColor: c.surfaceAlt,
                  borderWidth: 1,
                  borderColor: c.border,
                  fontSize: 16,
                },
              ]}
            />
            {text.trim() ? (
              <IconButton testID="send-note" icon={Send} label="Send note" tone="primary" size={COMPOSER_MIN} onPress={sendTyped} />
            ) : (
              <IconButton testID="quick-voice" icon={Mic} label="Record a voice note" size={COMPOSER_MIN} onPress={() => open({ kind: 'voice', hug: false })} />
            )}
          </Row>
        </View>
      </KeyboardAvoidingView>

      {/* Photo / video preview. Nothing leaves the phone until Send. */}
      <Sheet visible={draft?.kind === 'photo' || draft?.kind === 'video'} onClose={() => setDraft(null)}>
        {draft?.kind === 'photo' || draft?.kind === 'video' ? (
          <View style={{ gap: space.sm }}>
            {draft.kind === 'photo' ? (
              <Image
                source={{ uri: draft.photo.uri }}
                style={{ width: '100%', aspectRatio: draft.photo.width / draft.photo.height, maxHeight: 280, borderRadius: radius.md }}
                contentFit="cover"
                accessibilityLabel="Photo to send"
              />
            ) : (
              <Row gap={space.md} style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.md }}>
                {draft.video.thumbUri ? (
                  <Image source={{ uri: draft.video.thumbUri }} style={{ width: 72, height: 72, borderRadius: radius.sm }} contentFit="cover" />
                ) : (
                  <Video color={c.primary} size={32} />
                )}
                <T>Video · {Math.round(draft.video.durationMs / 1000)} seconds</T>
              </Row>
            )}
            <TextInput
              testID="photo-caption"
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption (optional)"
              placeholderTextColor={c.textMuted}
              maxLength={500}
              style={input}
            />
            <PrivacyOptions value={opts} onChange={setOpts} partnerName={partnerName} />
            <Button testID="send-photo" label={`Send to ${partnerName}`} icon={Send} onPress={sendDraft} />
            <Button label="Not this one" kind="ghost" small onPress={() => setDraft(null)} />
          </View>
        ) : null}
      </Sheet>

      {/* Video source */}
      <Sheet visible={draft?.kind === 'video-source'} onClose={() => setDraft(null)}>
        <T variant="title" center>
          Send a video
        </T>
        <T muted center>
          Up to 60 seconds. You can trim it before sending.
        </T>
        <Gap h={space.lg} />
        <Button label="Record a video" icon={Camera} onPress={() => startVideo('camera')} />
        <Gap h={space.sm} />
        <Button testID="choose-video" label="Choose from my videos" kind="soft" icon={Video} onPress={() => startVideo('library')} />
      </Sheet>

      {/* Voice note / voice hug */}
      <Sheet visible={draft?.kind === 'voice'} onClose={() => setDraft(null)}>
        {draft?.kind === 'voice' ? (
          <View style={{ gap: space.sm }}>
            <T variant="title" center>
              {draft.hug ? 'Send a voice hug' : 'Record a voice note'}
            </T>
            <T muted center>
              {draft.hug ? `Ten warm seconds of your voice for ${partnerName}.` : 'Hold the mic and talk. Let go to send, or slide left to cancel.'}
            </T>
            <Segmented
              value={draft.hug ? 'hug' : 'note'}
              onChange={(v) => setDraft({ kind: 'voice', hug: v === 'hug' })}
              options={[
                { value: 'note', label: 'Voice note' },
                { value: 'hug', label: 'Voice hug (10s)' },
              ]}
            />
            <PrivacyOptions value={opts} onChange={setOpts} partnerName={partnerName} />
            <VoiceRecorder testID="record" maxMs={draft.hug ? LIMITS.voiceHugMs : LIMITS.voiceMaxMs} onDone={sendVoice} />
          </View>
        ) : null}
      </Sheet>

      {/* Which notes to show: all, starred or saved. */}
      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)}>
        <View style={{ gap: space.xs }}>
          <T variant="small" muted center style={{ marginBottom: space.sm }}>
            Show
          </T>
          {(
            [
              { value: 'all', icon: Mail, label: 'All notes' },
              { value: 'starred', icon: Star, label: 'Starred (to remember)' },
              { value: 'saved', icon: Heart, label: 'Saved (loved)' },
            ] as const
          ).map((o) => (
            <OptionRow
              key={o.value}
              testID={`filter-${o.value}`}
              icon={filter === o.value ? Check : o.icon}
              label={o.label}
              onPress={() => {
                haptic.tap();
                setFilter(o.value);
                setFilterOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>

      {/* Long-press a note for its options (like Messages and WhatsApp). */}
      <Sheet visible={!!optionsFor} onClose={() => setOptionsFor(null)}>
        {optionsFor ? (
          <View style={{ gap: space.xs }}>
            <T variant="small" muted center numberOfLines={2} style={{ marginBottom: space.sm }}>
              {optionsFor.text ||
                (optionsFor.kind === 'photo' ? 'A photo' : optionsFor.kind === 'video' ? 'A video' : optionsFor.kind === 'voice' ? 'A voice note' : 'A hug')}
            </T>
            {!optionsFor.viewOnce ? (
              <OptionRow
                testID="opt-love"
                icon={Heart}
                label={optionsFor.favoriteBy?.includes(uid) ? 'Remove from Saved' : 'Love it (save to Saved)'}
                onPress={() => {
                  const m = optionsFor;
                  setOptionsFor(null);
                  toggleFavorite(cid, uid, m).catch(() => toast(gentleError.save));
                }}
              />
            ) : null}
            {!optionsFor.viewOnce ? (
              <OptionRow
                testID="opt-star"
                icon={Star}
                label={optionsFor.important ? 'Unstar' : 'Star it, so you both remember'}
                onPress={() => {
                  const m = optionsFor;
                  setOptionsFor(null);
                  toggleImportant(cid, uid, m)
                    .then(() => toast(m.important ? 'Unstarred.' : 'Starred. It stays pinned so you both remember.'))
                    .catch(() => toast(gentleError.save));
                }}
              />
            ) : null}
            {optionsFor.text && !optionsFor.viewOnce && optionsFor.kind !== 'hug' ? (
              <OptionRow
                testID="opt-todo"
                icon={todoFrom.has(optionsFor.id) ? Check : ListTodo}
                label={todoFrom.has(optionsFor.id) ? 'Already in to-dos. Open the list' : 'Add to our to-dos'}
                onPress={() => {
                  const m = optionsFor;
                  setOptionsFor(null);
                  noteToTodo(m);
                }}
              />
            ) : null}
            {optionsFor.text && !optionsFor.viewOnce ? (
              <OptionRow
                testID="opt-copy"
                icon={Copy}
                label="Copy text"
                onPress={() => {
                  const text = optionsFor.text ?? '';
                  setOptionsFor(null);
                  Clipboard.setStringAsync(text)
                    .then(() => toast('Copied.'))
                    .catch(() => toast('Couldn’t copy just now.'));
                }}
              />
            ) : null}
            {optionsFor.mediaId && !optionsFor.viewOnce ? (
              <OptionRow
                testID="opt-media"
                icon={Images}
                label="See all photos, videos and voice notes"
                onPress={() => {
                  setOptionsFor(null);
                  router.push('/notes-media');
                }}
              />
            ) : null}
            {optionsFor.fromUid === uid ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} />
                <OptionRow
                  testID="opt-take-back"
                  icon={Trash}
                  label="Take it back"
                  quiet
                  onPress={() => {
                    const m = optionsFor;
                    setOptionsFor(null);
                    setConfirmDelete(m);
                  }}
                />
              </>
            ) : null}
            <Gap h={space.sm} />
            <Button label="Close" kind="ghost" small onPress={() => setOptionsFor(null)} />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <T variant="title" center>
          Take this note back?
        </T>
        <Gap h={space.sm} />
        <T muted center>
          It will disappear for both of you, including any photo, video or voice in it.
        </T>
        <Gap h={space.xl} />
        <Button
          testID="confirm-take-back"
          label="Take it back"
          onPress={async () => {
            const m = confirmDelete;
            setConfirmDelete(null);
            if (m) await deleteMessage(cid, m).catch(() => toast(gentleError.save));
          }}
        />
        <Gap h={space.sm} />
        <Button label="Keep it" kind="ghost" onPress={() => setConfirmDelete(null)} />
      </Sheet>
    </SafeAreaView>
  );
}

type FeedItem = { key: string; at: number; m?: Message; s?: ScheduledNote };

/** A scheduled note or surprise. Surprises arrive wrapped, and unwrap with confetti. */
function ScheduledBubble({ n, uid, cid, partnerName }: { n: ScheduledNote; uid: string; cid: string; partnerName: string }) {
  const { c } = useTheme();
  const { toast } = useFeedback();
  const celebrate = useCelebrate();
  const mine = n.fromUid === uid;
  const fav = n.favoriteBy?.includes(uid);
  const wrapped = !mine && n.surprise !== 'none' && !n.openedAt;
  const fg = mine ? c.onPrimary : c.text;

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {wrapped ? (
        <Pressable
          testID="unwrap-surprise"
          accessibilityRole="button"
          accessibilityLabel={`A surprise from ${partnerName}. Tap to unwrap`}
          onPress={async () => {
            await openSurprise(cid, n.id).catch(() => toast(gentleError.save));
            celebrate(`A surprise from ${partnerName} \u2665`);
          }}
          style={{ maxWidth: '86%', backgroundColor: c.heartSoft, borderRadius: radius.lg, padding: space.lg, borderWidth: 1.5, borderColor: c.heart, borderStyle: 'dashed' }}>
          <Row gap={space.md}>
            <Gift color={c.heart} size={30} />
            <View>
              <T variant="heading">A surprise from {partnerName}</T>
              <T variant="small" muted>
                Tap to unwrap
              </T>
            </View>
          </Row>
        </Pressable>
      ) : (
        <View
          style={{
            maxWidth: '86%',
            backgroundColor: mine ? c.primary : c.surface,
            borderRadius: radius.lg,
            padding: space.lg,
            gap: space.sm,
            borderWidth: mine ? 0 : 1,
            borderColor: c.border,
          }}>
          {n.mediaId ? <MediaById cid={cid} mediaId={n.mediaId} tone={mine ? 'onPrimary' : 'surface'} caption={n.text} /> : null}
          {n.text ? (
            <T testID="scheduled-text" color={fg}>
              {n.text}
            </T>
          ) : null}
        </View>
      )}
      <Row gap={space.xs} style={{ marginTop: 2 }}>
        {n.surprise !== 'none' ? <Gift color={c.textMuted} size={13} /> : <CalendarClock color={c.textMuted} size={13} />}
        <T variant="small" muted>
          {relativeTime((n.surprise === 'open' ? n.createdAt?.toDate?.() : null) ?? n.deliverAt.toDate())} · {n.surprise === 'none' ? 'scheduled' : mine ? (n.openedAt ? 'surprise opened' : 'surprise waiting') : 'surprise'}
        </T>
        {!mine && !wrapped ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fav ? 'Remove from saved' : 'Save this note'}
            onPress={() => toggleScheduledFavorite(cid, uid, n).catch(() => toast(gentleError.save))}
            hitSlop={10}
            style={{ padding: 8 }}>
            <Heart color={fav ? c.heart : c.textMuted} fill={fav ? c.heart : 'transparent'} size={18} />
          </Pressable>
        ) : null}
      </Row>
    </View>
  );
}

function fadesIn(m: Message): string | null {
  if (!m.expiresAt) return null;
  const h = Math.max(1, Math.round((m.expiresAt.toMillis() - Date.now()) / 3600_000));
  return h >= 1 ? `fades in ${h}h` : 'fading soon';
}

function Bubble({
  m,
  mine,
  uid,
  cid,
  partnerName,
  onOptions,
  showTime,
}: {
  m: Message;
  mine: boolean;
  /** Only the newest note of a burst (same person, within an hour) shows the time. */
  showTime: boolean;
  uid: string;
  cid: string;
  partnerName: string;
  /** Long-press (or the screen reader's "More options") opens the note's options. */
  onOptions: () => void;
}) {
  const { c, textScale } = useTheme();
  // Compact, like a messaging app: smaller type and tighter bubbles, so more fits on screen.
  const msg = { fontSize: Math.round(15 * textScale), lineHeight: Math.round(20 * textScale) };
  const fav = m.favoriteBy?.includes(uid);
  const fg = mine ? c.onPrimary : c.text;
  const when = relativeTime(m.createdAt?.toDate?.() ?? null);
  const fade = fadesIn(m);
  const canStar = !m.viewOnce;

  let body: React.ReactNode;
  if (m.kind === 'hug') {
    body = (
      <Row gap={space.sm}>
        <Heart color={mine ? c.onPrimary : c.heart} fill={mine ? c.onPrimary : c.heart} size={18} />
        <T variant="bodyStrong" color={fg} style={msg}>
          {mine ? `You sent ${partnerName} a hug` : `${partnerName} sent you a hug`}
        </T>
      </Row>
    );
  } else if (m.viewOnce) {
    body = <ViewOnceNote cid={cid} m={m} mine={mine} partnerName={partnerName} />;
  } else if (m.mediaId) {
    body = (
      <View style={{ gap: 6, width: 232, maxWidth: '100%' }}>
        <NoteMedia cid={cid} m={m} mine={mine} />
        {m.text ? (
          <T color={fg} style={[msg, { paddingHorizontal: 6, paddingBottom: 2 }]}>
            {m.text}
          </T>
        ) : null}
      </View>
    );
  } else {
    body = (
      <T testID="note-text" color={fg} style={msg}>
        {m.text}
      </T>
    );
  }

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <Pressable
        testID={`note-${m.id}`}
        accessibilityHint="Long press for options: love, star, add to to-dos, copy"
        accessibilityActions={[{ name: 'longpress', label: 'More options' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onOptions()}
        onLongPress={onOptions}
        delayLongPress={400}
        style={{
          maxWidth: '80%',
          backgroundColor: mine ? c.primary : c.surface,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          paddingHorizontal: m.mediaId && !m.viewOnce ? 4 : 12,
          paddingVertical: m.mediaId && !m.viewOnce ? 4 : 7,
          borderWidth: mine ? 0 : 1,
          borderColor: c.border,
        }}>
        {body}
      </Pressable>
      {m.important && canStar ? (
        <Row gap={4} style={{ marginTop: 2 }}>
          <Star color={c.onButter} fill={c.onButter} size={11} />
          <T testID="important-badge" variant="small" color={c.onButter}>
            Important
          </T>
        </Row>
      ) : null}
      {showTime || fade || fav ? (
        <Row gap={space.xs} style={{ marginTop: 2, flexWrap: 'wrap', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
          {fade ? <Clock color={c.textMuted} size={12} accessibilityLabel="Disappearing note" /> : null}
          {showTime || fade ? (
            <T testID={showTime ? 'note-time' : undefined} variant="small" muted style={{ fontSize: Math.round(12 * textScale), lineHeight: Math.round(16 * textScale) }}>
              {[showTime ? when : null, fade, showTime && mine && m.readAt ? 'seen' : null].filter(Boolean).join(' · ')}
            </T>
          ) : null}
          {fav ? <Heart color={c.heart} fill={c.heart} size={13} accessibilityLabel="Saved" /> : null}
        </Row>
      ) : null}
    </View>
  );
}

/** "Aina is typing…" with three softly pulsing dots, just above the composer. */
function TypingLine({ name }: { name: string }) {
  const { c, motion } = useTheme();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (motion === 'off') return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [motion, v]);
  return (
    <View testID="partner-typing" accessibilityLiveRegion="polite" accessibilityLabel={`${name} is typing`} style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.md, paddingBottom: 6 }}>
      <Row gap={space.sm}>
        <View style={{ flexDirection: 'row', gap: 4, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, borderBottomLeftRadius: 6, paddingHorizontal: 12, paddingVertical: 10 }}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: c.textMuted,
                opacity: motion === 'off' ? 0.6 : v.interpolate({ inputRange: [0, 0.2 + i * 0.15, 0.45 + i * 0.15, 1], outputRange: [0.3, 1, 0.3, 0.3], extrapolate: 'clamp' }),
                transform: motion === 'off' ? [] : [{ translateY: v.interpolate({ inputRange: [0, 0.2 + i * 0.15, 0.45 + i * 0.15, 1], outputRange: [0, -3, 0, 0], extrapolate: 'clamp' }) }],
              }}
            />
          ))}
        </View>
        <T variant="small" muted>
          {name} is typing…
        </T>
      </Row>
    </View>
  );
}
