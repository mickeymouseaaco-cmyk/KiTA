/** Question of the day: answer, then see each other's answers. */
import { Lock, MessageCircleHeart, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, EmptyState, Gap, Row, Screen, SectionTitle, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { dayKey, fromDayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import {
  ANSWER_MAX,
  QUESTIONS,
  questionFor,
  questionStatus,
  saveAnswer,
  useAnswer,
  useQuestionDay,
  useRecentQuestionDays,
  type QuestionDay,
} from '@/lib/questions';
import { usePaired } from '@/lib/session';
import { radius, space, useTheme } from '@/theme';

function AnswerBubble({ who, text, tone }: { who: string; text: string; tone: 'peach' | 'sage' }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: tone === 'peach' ? c.peach : c.sage, borderRadius: radius.md, padding: space.lg, gap: space.xs }}>
      <T variant="label" color={tone === 'peach' ? c.onPeach : c.onSage}>
        {who}
      </T>
      <T color={tone === 'peach' ? c.onPeach : c.onSage}>{text}</T>
    </View>
  );
}

/** A past day you both answered: tap to open both answers. */
function PastDay({ day, cid, uid, partnerId, partnerName }: { day: QuestionDay; cid: string; uid: string; partnerId: string; partnerName: string }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const mine = useAnswer(cid, day.date, uid, open);
  const theirs = useAnswer(cid, day.date, partnerId, open);
  const text = day.qid !== null && day.qid !== undefined ? QUESTIONS[day.qid] : questionFor(day.date, cid).text;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)}>
      <Card style={{ marginBottom: space.sm, paddingVertical: space.md }}>
        <T variant="small" muted>
          {fromDayKey(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
        </T>
        <T variant="bodyStrong">{text}</T>
        {open ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {mine ? <AnswerBubble who="You" text={mine.text} tone="peach" /> : null}
            {theirs ? <AnswerBubble who={partnerName} text={theirs.text} tone="sage" /> : null}
            {mine === undefined || theirs === undefined ? <T muted>Opening…</T> : null}
          </View>
        ) : (
          <T variant="small" color={c.primary} style={{ marginTop: space.xs }}>
            Tap to see both answers
          </T>
        )}
      </Card>
    </Pressable>
  );
}

export default function QuestionScreen() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { toast } = useFeedback();
  const today = dayKey();
  const q = questionFor(today, cid);
  const day = useQuestionDay(cid, today);
  const mine = useAnswer(cid, today, uid);
  const theirs = useAnswer(cid, today, partnerId, !!mine);
  const partnerAnswered = !!day?.answered?.includes(partnerId);
  const status = questionStatus(!!mine, partnerAnswered);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const past = useRecentQuestionDays(cid).filter((d) => d.date !== today && d.answered.includes(uid) && d.answered.includes(partnerId));

  async function send() {
    setBusy(true);
    try {
      await saveAnswer(cid, today, uid, q.id, draft);
      haptic.success();
      setEditing(false);
      toast(partnerAnswered ? `Here’s what ${partnerName} said.` : `Saved. We’ll tell you when ${partnerName} answers.`);
    } catch {
      toast(gentleError.save);
    } finally {
      setBusy(false);
    }
  }

  const showForm = mine === null || editing;

  return (
    <Screen edges={['bottom']}>
      <Card tone="peach">
        <Row gap={space.sm}>
          <MessageCircleHeart color={c.onPeach} size={22} />
          <T variant="label" color={c.onPeach}>
            TODAY’S QUESTION
          </T>
        </Row>
        <Gap h={space.sm} />
        <T testID="question-text" variant="title" color={c.onPeach}>
          {q.text}
        </T>
        <Gap h={space.sm} />
        <T variant="small" color={c.onPeach}>
          {status === 'both'
            ? 'You both answered. Here they are.'
            : status === 'partner-waiting'
              ? `${partnerName} has answered. Answer yours to see it.`
              : status === 'waiting-for-partner'
                ? `Waiting for ${partnerName}. We’ll let you know.`
                : `Answer first; ${partnerName}’s answer opens once you both have.`}
        </T>
      </Card>
      <Gap />

      {mine === undefined ? (
        <T muted>Loading…</T>
      ) : showForm ? (
        <Card>
          <TextInput
            testID="answer-input"
            value={draft}
            onChangeText={setDraft}
            placeholder="Your answer…"
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={ANSWER_MAX}
            style={[input, { minHeight: 110, textAlignVertical: 'top' }]}
          />
          <Gap h={space.md} />
          <Button testID="answer-send" label={editing ? 'Save my answer' : 'Share my answer'} loading={busy} disabled={!draft.trim()} hint="Write a few words first." onPress={send} />
          <Gap h={space.sm} />
          <Row gap={6} style={{ justifyContent: 'center' }}>
            <Lock color={c.textMuted} size={14} />
            <T variant="small" muted>
              Only {partnerName} can see it, and only once they’ve answered too.
            </T>
          </Row>
        </Card>
      ) : (
        <View style={{ gap: space.sm }}>
          <AnswerBubble who="You" text={mine!.text} tone="peach" />
          {theirs ? (
            <AnswerBubble who={partnerName} text={theirs.text} tone="sage" />
          ) : (
            <Card tone="lavender">
              <T testID="answer-waiting" muted>
                {partnerName}’s answer will appear here as soon as they’ve shared it.
              </T>
            </Card>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDraft(mine!.text);
              setEditing(true);
            }}
            hitSlop={8}
            style={{ alignSelf: 'center', minHeight: 40, justifyContent: 'center' }}>
            <Row gap={6}>
              <Pencil color={c.primary} size={16} />
              <T variant="bodyStrong" color={c.primary}>
                Edit my answer
              </T>
            </Row>
          </Pressable>
        </View>
      )}

      <Gap h={space.xl} />
      <SectionTitle>Earlier answers</SectionTitle>
      {past.length ? (
        past.map((d) => <PastDay key={d.date} day={d} cid={cid} uid={uid} partnerId={partnerId} partnerName={partnerName} />)
      ) : (
        <EmptyState icon={MessageCircleHeart} line="Days you both answer will gather here, so you can look back together." />
      )}
    </Screen>
  );
}
