import { router } from 'expo-router';
import { CalendarHeart, ChevronRight, MapPin, UtensilsCrossed, MessageCircleHeart, Eye, Footprints, Heart, Lock, Mail, Moon, Pencil, Smile, Smartphone, Wind, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CoupleArt } from '@/components/art';
import { ProgressRing, WeekBars } from '@/components/charts';
import { useFeedback } from '@/components/feedback';
import { InstallBanner } from '@/components/install-banner';
import { FoodCardBody, MealSheet, mealNow } from '@/components/food-card';
import { LiveSky } from '@/components/live-sky';
import { VividAction, type BurstHandle } from '@/components/vivid';
import { StoredPrivateImage, StoredPrivateVoice } from '@/components/media-view';
import { TodoRow } from '@/components/todo-row';
import { DaySwitch, TopBar } from '@/components/headers';
import { Button, Card, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { STRESS_LABELS, empty, gentleError, greeting, streakLine, summaryLine } from '@/lib/copy';
import { dayKey, lastNDays, timeOfDay } from '@/lib/dates';
import { PHASE_LABEL, cycleToday, predictionLine } from '@/lib/cycle';
import { syncCycleDay, useCycleSettings, useMyDays, usePartnerDays, useShareSettings } from '@/lib/logs';
import { haptic } from '@/lib/haptics';
import { questionFor, questionStatus, useAnswer, useQuestionDay } from '@/lib/questions';
import { sendHug } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { todayList, useTodos } from '@/lib/todos';
import { AREAS, LEVEL_LABEL, skyKind, useFloodWatch, weatherWords, worst } from '@/lib/flood';
import { hourInMalaysia, timeOfDay as skyTime } from '@/lib/sky-pure';
import { radius, space, useTheme, vivid } from '@/theme';

/** Consecutive days (ending today or yesterday) with any check-in. Celebration only. */
function streak(days: Record<string, unknown>, keys: string[]): number {
  let n = 0;
  const list = [...keys].reverse();
  const start = days[list[0]] ? 0 : 1; // today not logged yet doesn't break a streak
  for (let i = start; i < list.length; i++) {
    if (days[list[i]]) n++;
    else break;
  }
  return n;
}

function ShareNote({ shared, partnerName }: { shared: boolean; partnerName: string }) {
  const { c } = useTheme();
  const Icon = shared ? Eye : Lock;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={shared ? `Shared with ${partnerName}. Change in privacy settings` : 'Just for you. Change in privacy settings'}
      onPress={() => router.push('/privacy')}
      hitSlop={8}
      style={{ minHeight: 32, justifyContent: 'center' }}>
      <Row gap={6}>
        <Icon color={c.textMuted} size={14} />
        <T variant="small" muted>
          {shared ? `Shared with ${partnerName}` : 'Just for you'}
        </T>
      </Row>
    </Pressable>
  );
}

/** A tidy, tappable one-line card: icon, a few words, and an arrow. */
function LinkCard({ icon: Icon, title, detail, onPress, testID, tone = 'surface', color }: { icon: LucideIcon; title: string; detail?: string; onPress: () => void; testID?: string; tone?: 'surface' | 'sky' | 'butter' | 'peach' | 'sage' | 'lavender'; color?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={onPress}>
      <Card tone={tone} style={{ paddingVertical: space.md }}>
        <Row gap={space.md}>
          <Icon color={color ?? c.primary} size={24} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" color={color}>
              {title}
            </T>
            {detail ? (
              <T variant="small" color={color} muted={!color} numberOfLines={2}>
                {detail}
              </T>
            ) : null}
          </View>
          <ChevronRight color={color ?? c.textMuted} size={20} />
        </Row>
      </Card>
    </Pressable>
  );
}

export default function Today() {
  const { c, look } = useTheme();
  const who = usePaired();
  const { uid, cid, partnerId, myName, partnerName, profile } = who;
  const { toast } = useFeedback();
  const month = useMemo(() => lastNDays(30), []);
  const week = month.slice(-7);
  const today = dayKey();
  const { days, ready } = useMyDays(uid, month[0]);
  const share = useShareSettings(uid);
  const day = days[today];
  const goal = day?.stepGoal ?? profile?.stepGoal ?? 8000;
  const streakText = streakLine(streak(days, month));
  const cycleSettings = useCycleSettings(uid);
  const cycle = day?.cycle ?? (cycleSettings ? cycleToday(cycleSettings, today) : null);
  const { todos, ready: todosReady } = useTodos(cid);
  const myToday = todayList(todos, uid, today);
  const flood = useFloodWatch();
  const [mealOpen, setMealOpen] = useState(false);
  const mealTile = useRef<BurstHandle>(null);
  const hugTile = useRef<BurstHandle>(null);
  const floodLevel = worst(AREAS.map((a) => flood.status[a.id]?.level ?? 'calm'));
  const floodArea = AREAS.find((a) => flood.status[a.id]?.level === floodLevel) ?? AREAS[0];
  const todayRain = flood.data?.forecast[floodArea.id]?.[0];
  const skyNow = flood.data?.now?.[floodArea.id] ?? null;
  const skyClock = skyTime(hourInMalaysia());
  const skyTod = !skyNow ? skyClock : !skyNow.isDay ? 'night' : skyClock === 'night' ? 'day' : skyClock;
  const partner = usePartnerDays(cid, partnerId, today).days[today];
  const evening = new Date().getHours() >= 18;
  const question = questionFor(today, cid);
  const qDay = useQuestionDay(cid, today);
  const myAnswer = useAnswer(cid, today, uid);
  const qStatus = questionStatus(!!myAnswer, !!qDay?.answered?.includes(partnerId));
  const answered = !!(day?.checkIn && (day.checkIn.text || day.checkIn.voicePath || day.checkIn.memoryId));
  const partnerLine = partner
    ? [
        typeof partner.steps === 'number' ? `${partner.steps.toLocaleString()} steps` : null,
        partner.mood ? `feeling ${partner.mood.label.toLowerCase()} ${partner.mood.emoji}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  // Keep today's cycle day fresh (it changes at midnight, not when you log).
  const needsCycleSync = ready && !!cycleSettings?.enabled && !day?.cycle;
  useEffect(() => {
    if (needsCycleSync && cycleSettings) syncCycleDay({ uid, cid }, cycleSettings, undefined).catch(() => {});
  }, [needsCycleSync, cycleSettings, uid, cid]);

  return (
    <Screen>
      <TopBar
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        title={greeting(myName, timeOfDay()) + (look.emoji ? ` ${{ morning: '☀️', afternoon: '🌤️', evening: '🌙' }[timeOfDay()]}` : '')}
      />
      <DaySwitch value="mine" />
      <InstallBanner />

      {/* A warm hello: how today is going, and a word from your partner. */}
      <Card tone="peach">
        <Row gap={space.md} style={{ alignItems: 'center' }}>
          <View style={{ flex: 1, gap: space.xs }}>
            <T testID="summary-line" variant="heading" color={c.onPeach}>
              {ready ? summaryLine(day?.steps, day?.mood?.stress) : ' '}
            </T>
            {streakText ? (
              <T variant="small" color={c.onPeach}>
                {streakText}
              </T>
            ) : null}
            <T testID="partner-line" variant="small" color={c.onPeach} style={{ fontFamily: 'Raleway_600SemiBold' }}>
              {partnerLine ? `${partnerName}: ${partnerLine}` : `Nothing from ${partnerName} yet today.`}
            </T>
          </View>
          <CoupleArt size={104} />
        </Row>
      </Card>
      <Gap h={space.lg} />

      {/* The things you do most, one tap away. */}
      <Row gap={space.xs} style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <VividAction testID="qa-steps" icon={Footprints} label="Steps" color="green" style={{ flex: 1 }} onPress={() => router.push('/log-steps')} />
        <VividAction testID="qa-mood" icon={Smile} label="Mood" color="amber" style={{ flex: 1 }} onPress={() => router.push('/log-mood')} />
        <VividAction ref={mealTile} testID="qa-meal" icon={UtensilsCrossed} label="Meal" color="orange" style={{ flex: 1 }} onPress={() => setMealOpen(true)} />
        <VividAction testID="qa-note" icon={Mail} label="Note" color="blue" style={{ flex: 1 }} onPress={() => router.push('/notes')} />
        <VividAction
          ref={hugTile}
          testID="qa-hug"
          icon={Heart}
          label="Hug"
          color="pink"
          style={{ flex: 1 }}
          onPress={() =>
            sendHug(who)
              .then(() => {
                haptic.success();
                hugTile.current?.burst();
                toast(`Hug sent to ${partnerName}.`);
              })
              .catch(() => toast(gentleError.send))
          }
        />
      </Row>
      <MealSheet ctx={{ uid, cid }} visible={mealOpen} start={mealNow()} onClose={() => setMealOpen(false)} onSaved={() => mealTile.current?.burst()} />
      <Gap h={space.lg} />

      {/* Question of the day: answer to see your partner's. */}
      <Pressable testID="open-question" accessibilityRole="button" onPress={() => router.push('/question')}>
        <Card tone="butter">
          <Row gap={space.sm}>
            <MessageCircleHeart color={c.onButter} size={20} />
            <T variant="label" color={c.onButter} style={{ flex: 1 }}>
              QUESTION OF THE DAY
            </T>
            <ChevronRight color={c.onButter} size={18} />
          </Row>
          <Gap h={space.xs} />
          <T variant="heading" color={c.onButter}>
            {question.text}
          </T>
          <T testID="question-status" variant="small" color={c.onButter} style={{ marginTop: space.xs, fontFamily: 'Raleway_600SemiBold' }}>
            {qStatus === 'both'
              ? 'You both answered. Tap to see.'
              : qStatus === 'partner-waiting'
                ? `${partnerName} answered. Your turn!`
                : qStatus === 'waiting-for-partner'
                  ? `Waiting for ${partnerName}…`
                  : 'Tap to answer'}
          </T>
        </Card>
      </Pressable>
      <Gap />

      <Card>
        <SectionTitle right={<ShareNote shared={!!share?.steps} partnerName={partnerName} />}>Steps</SectionTitle>
        <Row gap={space.lg} style={{ alignItems: 'center' }}>
          <ProgressRing value={day?.steps ?? 0} goal={goal} size={112} stroke={12} color={vivid.green[1]} />
          <View style={{ flex: 1 }}>
            <WeekBars days={week} values={week.map((k) => days[k]?.steps)} goal={goal} height={72} color={vivid.green[1]} />
          </View>
        </Row>
        <Gap h={space.sm} />
        <T muted>{day?.steps ? 'Nice and steady. Add more any time.' : empty.steps}</T>
        <Row gap={space.lg} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
          <Pressable testID="log-steps" accessibilityRole="button" onPress={() => router.push('/log-steps')} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center' }}>
            <Row gap={6}>
              <Footprints color={c.primary} size={18} />
              <T variant="bodyStrong" color={c.primary}>
                Log steps
              </T>
            </Row>
          </Pressable>
          <Pressable testID="today-steps-sync" accessibilityRole="button" onPress={() => router.push('/steps-sync')} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center' }}>
            <Row gap={6}>
              <Smartphone color={c.primary} size={18} />
              <T variant="bodyStrong" color={c.primary}>
                Sync from iPhone
              </T>
            </Row>
          </Pressable>
        </Row>
      </Card>
      <Gap />

      <Card>
        <SectionTitle right={<ShareNote shared={!!share?.mood} partnerName={partnerName} />}>Mood</SectionTitle>
        {day?.mood ? (
          <Row gap={space.lg}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {day.mood.media?.type === 'photo' ? (
                <StoredPrivateImage path={day.mood.media.path} size={64} alt="Your mood selfie" />
              ) : (
                <T style={{ fontSize: 36, lineHeight: 44 }} accessibilityElementsHidden>
                  {day.mood.emoji}
                </T>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <T testID="my-mood" variant="heading">
                {day.mood.label}
              </T>
              <T muted>Stress: {STRESS_LABELS[day.mood.stress].toLowerCase()}</T>
              {day.mood.media?.type === 'voice' ? (
                <View style={{ marginTop: space.xs }}>
                  <StoredPrivateVoice path={day.mood.media.path} durationMs={day.mood.media.durationMs} />
                </View>
              ) : null}
              {day.mood.note ? (
                <T variant="small" muted numberOfLines={2} style={{ marginTop: 2 }}>
                  &ldquo;{day.mood.note}&rdquo;
                </T>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Update mood" onPress={() => router.push('/log-mood')} hitSlop={8} style={{ padding: space.sm }}>
              <Pencil color={c.primary} size={22} />
            </Pressable>
          </Row>
        ) : (
          <Pressable testID="log-mood" accessibilityRole="button" onPress={() => router.push('/log-mood')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Row gap={space.sm}>
              <T muted style={{ flex: 1 }}>
                {empty.mood}
              </T>
              <T variant="bodyStrong" color={c.primary}>
                Check in
              </T>
              <ChevronRight color={c.primary} size={18} />
            </Row>
          </Pressable>
        )}
      </Card>
      <Gap />

      <LinkCard testID="open-find" icon={MapPin} title={`Find ${partnerName}`} detail="See where you both are, if you each choose to share." onPress={() => router.push('/find')} />
      <Gap />

      {/* A window onto the sky near home, live. */}
      <Pressable
        testID="open-weather"
        accessibilityRole="button"
        accessibilityLabel={`Weather and floods near ${floodArea.name}: ${skyNow ? `${skyNow.tempC} degrees, ${weatherWords(skyNow.code)}` : todayRain ? weatherWords(todayRain.code) : 'checking'}. Flood watch: ${LEVEL_LABEL[floodLevel]}. Open the weather`}
        onPress={() => router.push('/weather')}
        style={({ pressed }) => ({ transform: [{ scale: pressed && look.flat ? 0.985 : 1 }] })}>
        <LiveSky kind={skyNow ? skyKind(skyNow.code) : todayRain ? skyKind(todayRain.code) : 'partly'} tod={skyTod} height={124} radius={look.cardRadius}>
          <View style={{ flex: 1, paddingHorizontal: space.lg, paddingVertical: space.md, justifyContent: 'space-between' }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="label" color="#FFFFFF" numberOfLines={1} style={{ flex: 1, opacity: 0.92, letterSpacing: 0.8 }}>
                {floodArea.name.toUpperCase()}
              </T>
              <Row gap={2} style={{ backgroundColor: floodLevel === 'calm' ? 'rgba(255,255,255,0.22)' : floodLevel === 'watch' ? '#FFCE52' : '#FF6136', borderRadius: 999, paddingLeft: 10, paddingRight: 6, paddingVertical: 3 }}>
                <T variant="small" color={floodLevel === 'watch' ? '#3A2A00' : '#FFFFFF'} style={{ fontFamily: 'Raleway_700Bold', fontSize: 12, lineHeight: 16 }}>
                  {floodLevel === 'calm' ? 'No floods' : floodLevel === 'watch' ? 'Flood watch' : 'Flood warning'}
                </T>
                <ChevronRight color={floodLevel === 'watch' ? '#3A2A00' : '#FFFFFF'} size={14} />
              </Row>
            </Row>
            <Row gap={space.sm} style={{ alignItems: 'baseline' }}>
              <T color="#FFFFFF" style={{ fontSize: 44, lineHeight: 50, fontWeight: '300', letterSpacing: -1.5 }}>
                {skyNow ? `${skyNow.tempC}°` : todayRain ? `${todayRain.maxC}°` : '–'}
              </T>
              <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1} style={{ flexShrink: 1 }}>
                {skyNow ? weatherWords(skyNow.code) : todayRain ? weatherWords(todayRain.code) : flood.loading ? 'Checking…' : 'Weather'}
              </T>
            </Row>
          </View>
        </LiveSky>
      </Pressable>
      <Gap />

      <Card>
        <SectionTitle
          right={
            <Pressable testID="open-todos" accessibilityRole="link" onPress={() => router.push('/todos')} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
              <T variant="small" color={c.primary} style={{ fontFamily: 'Raleway_600SemiBold' }}>
                {myToday.length > 3 ? `See all ${myToday.length}` : myToday.length ? 'See all' : 'Add one'}
              </T>
            </Pressable>
          }>
          Today&apos;s to-dos
        </SectionTitle>
        {myToday.slice(0, 3).map((t) => (
          <TodoRow key={t.id} t={t} uid={uid} cid={cid} partnerName={partnerName} compact />
        ))}
        {todosReady && myToday.length === 0 ? <T muted>{empty.todosToday}</T> : null}
      </Card>
      <Gap />

      <Card>
        <SectionTitle right={<ShareNote shared={!!share?.food} partnerName={partnerName} />}>Meals</SectionTitle>
        <FoodCardBody ctx={{ uid, cid }} food={day?.food} />
      </Card>
      <Gap />

      {cycleSettings?.enabled && cycle ? (
        <>
          <LinkCard
            icon={CalendarHeart}
            tone="lavender"
            color={c.heart}
            title={`${PHASE_LABEL[cycle.phase]} · day ${cycle.day}`}
            detail={`${predictionLine(cycle)}${cycle.symptoms.length ? ` · ${cycle.symptoms.join(', ').toLowerCase()}` : ''}`}
            onPress={() => router.push('/cycle')}
          />
          <Gap />
        </>
      ) : null}

      {/* The evening check-in comes out in the evening (or once you've answered). */}
      {evening || answered ? (
        <>
          <Card tone="lavender">
            <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
              <Moon color={c.primary} size={24} />
              <View style={{ flex: 1, gap: space.xs }}>
                <T variant="heading">Evening check-in</T>
                {answered ? (
                  <T testID="checkin-summary" muted numberOfLines={2}>
                    {day?.checkIn?.text ? `\u201C${day.checkIn.text}\u201D` : 'You saved a voice moment tonight.'}
                  </T>
                ) : (
                  <T muted>What was one good moment today?</T>
                )}
              </View>
            </Row>
            <Gap h={space.md} />
            <Button testID="open-checkin" small kind="soft" label={answered ? 'See tonight\u2019s moment' : 'Answer'} onPress={() => router.push('/check-in')} />
          </Card>
          <Gap />
        </>
      ) : null}

      <LinkCard testID="open-calm" icon={Wind} tone="sage" color={c.onSage} title="Calm Corner" detail="Breathe for two minutes, soft sounds, or a private vent." onPress={() => router.push('/calm')} />

      {!cycleSettings?.enabled ? (
        <>
          <Gap h={space.sm} />
          <Button kind="ghost" small label="Track your cycle (optional, private)" onPress={() => router.push('/cycle')} />
        </>
      ) : null}
    </Screen>
  );
}
