import { router } from 'expo-router';
import { CalendarHeart, Circle, Eye, Footprints, Heart, ListChecks, Lock, Mail, MapPin, MessageCircleHeart, Moon, Navigation, Plus, Smile, UtensilsCrossed, Wind } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CoupleArt } from '@/components/art';
import { useFeedback } from '@/components/feedback';
import { InstallBanner } from '@/components/install-banner';
import { MealSheet, mealNow } from '@/components/food-card';
import { LiveSky } from '@/components/live-sky';
import { MyStatusPage, PartnerStatusPage } from '@/components/status-stack';
import { TekaTekiCard } from '@/components/teka-teki-card';
import { VividAction, type BurstHandle } from '@/components/vivid';
import { StoredPrivateImage } from '@/components/media-view';
import { SmartStack, StackPage, WIDGET_GAP, Widget, WidgetCaption, WidgetRing, WidgetRow, WidgetValue } from '@/components/widgets';
import { DaySwitch, TopBar } from '@/components/headers';
import { Button, Row, Screen, T } from '@/components/ui';
import { STRESS_LABELS, gentleError, greeting, streakLine, summaryLine } from '@/lib/copy';
import { dayKey, lastNDays, timeOfDay } from '@/lib/dates';
import { useStatuses } from '@/lib/status';
import { PHASE_LABEL, cycleToday, predictionLine } from '@/lib/cycle';
import { syncCycleDay, useCycleSettings, useMyDays, usePartnerDays, useShareSettings } from '@/lib/logs';
import { haptic } from '@/lib/haptics';
import { questionFor, questionStatus, useAnswer, useQuestionDay } from '@/lib/questions';
import { sendHug } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { todayList, useTodos } from '@/lib/todos';
import { AREAS, LEVEL_LABEL, skyKind, useFloodWatch, weatherWords } from '@/lib/flood';
import { placeLabel, temp, todFor, usePlaceWeather, useUnits, useWeatherPlace } from '@/lib/places';
import { hourInMalaysia, timeOfDay as skyTime } from '@/lib/sky-pure';
import { space, useTheme, vivid } from '@/theme';

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

export default function Today() {
  const { c, look } = useTheme();
  const who = usePaired();
  const { uid, cid, partnerId, myName, partnerName, profile } = who;
  const { toast } = useFeedback();
  const month = useMemo(() => lastNDays(30), []);
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
  // The sky card follows the place each person chose (anywhere in the world);
  // the flood label shows only for the Malaysian flood-watch areas.
  const [place] = useWeatherPlace();
  const [units] = useUnits();
  const anywhere = usePlaceWeather(place);
  const floodArea = place?.kind === 'area' ? AREAS.find((a) => a.id === place.id)! : null;
  const floodLevel = floodArea ? (flood.status[floodArea.id]?.level ?? 'calm') : 'calm';
  const todayRain = floodArea ? flood.data?.forecast[floodArea.id]?.[0] : anywhere.data?.days[0];
  const skyNow = floodArea ? (flood.data?.now?.[floodArea.id] ?? null) : (anywhere.data?.now ?? null);
  const skyTod = todFor(skyNow, floodArea ? skyTime(hourInMalaysia()) : 'day');
  const skyPlace = place ? placeLabel(place, (id) => AREAS.find((a) => a.id === id)!.name) : 'Your weather';
  const partner = usePartnerDays(cid, partnerId, today).days[today];
  const evening = new Date().getHours() >= 18;
  const question = questionFor(today, cid);
  const qDay = useQuestionDay(cid, today);
  const myAnswer = useAnswer(cid, today, uid);
  const { unseen } = useStatuses(cid, uid, partnerId);
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

  const weatherNow = skyNow ? temp(skyNow.tempC, units) : todayRain ? temp(todayRain.maxC, units) : place === null ? '' : '–';
  const weatherWord = skyNow ? weatherWords(skyNow.code) : todayRain ? weatherWords(todayRain.code) : place === null ? 'Tap to choose your place' : 'Checking…';
  const stepsPct = goal > 0 ? (day?.steps ?? 0) / goal : 0;
  const mealsToday = day?.food?.meals ?? [];
  const lastMeal = mealsToday[mealsToday.length - 1];
  const openTodos = myToday;
  // Smart Rotate, like iOS: open the stack on what matters most right now.
  const stackStart = unseen > 0 ? 0 : qStatus === 'partner-waiting' ? 2 : 1;

  return (
    <Screen>
      <TopBar
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        title={greeting(myName, timeOfDay()) + (look.emoji ? ` ${{ morning: '☀️', afternoon: '🌤️', evening: '🌙' }[timeOfDay()]}` : '')}
      />
      <DaySwitch value="mine" />
      <InstallBanner />

      {/* Smart stack: their status, your sky, today's question, your status. Swipe through. */}
      <SmartStack testID="home-stack" height={176} start={stackStart}>
        <PartnerStatusPage />
        <Pressable
          testID="open-weather"
          accessibilityRole="button"
          accessibilityLabel={place ? `Weather in ${skyPlace}: ${weatherNow}, ${weatherWord}.${floodArea ? ` Flood watch: ${LEVEL_LABEL[floodLevel]}.` : ''} Open the weather` : 'Choose a place for your weather'}
          onPress={() => router.push('/weather')}
          style={{ flex: 1 }}>
          <LiveSky kind={skyNow ? skyKind(skyNow.code) : todayRain ? skyKind(todayRain.code) : 'partly'} tod={skyTod} height={176} radius={0}>
            <View style={{ flex: 1, padding: 16, paddingRight: 22, justifyContent: 'space-between' }}>
              <Row gap={6}>
                <MapPin color="#FFFFFF" size={14} strokeWidth={2.6} />
                <T numberOfLines={1} color="#FFFFFF" style={{ flex: 1, fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
                  {skyPlace}
                </T>
                {floodArea ? (
                  <View style={{ backgroundColor: floodLevel === 'calm' ? 'rgba(255,255,255,0.22)' : floodLevel === 'watch' ? '#FFCE52' : '#FF6136', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
                    <T color={floodLevel === 'watch' ? '#3A2A00' : '#FFFFFF'} style={{ fontSize: 11, lineHeight: 15, fontWeight: '700' }}>
                      {floodLevel === 'calm' ? 'No floods' : floodLevel === 'watch' ? 'Flood watch' : 'Flood warning'}
                    </T>
                  </View>
                ) : null}
              </Row>
              <View>
                <WidgetValue color="#FFFFFF" size={46}>
                  {weatherNow}
                </WidgetValue>
                <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>
                  {weatherWord}
                  {todayRain ? `  ·  H:${temp(todayRain.maxC, units)} L:${temp(todayRain.minC, units)}` : ''}
                </T>
              </View>
            </View>
          </LiveSky>
        </Pressable>
        <StackPage fill="amber" testID="open-question" onPress={() => router.push('/question')} accessibilityLabel={`Question of the day: ${question.text}`}>
          <WidgetCaption icon={MessageCircleHeart} label="Question of the day" fill="amber" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <T variant="heading" color="#FFFFFF" numberOfLines={3} style={{ fontSize: 19, lineHeight: 24 }}>
              {question.text}
            </T>
          </View>
          <Row style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <T testID="question-status" color="#FFFFFF" style={{ fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
              {qStatus === 'both'
                ? 'You both answered. Tap to see.'
                : qStatus === 'partner-waiting'
                  ? `${partnerName} answered. Your turn!`
                  : qStatus === 'waiting-for-partner'
                    ? `Waiting for ${partnerName}…`
                    : 'Tap to answer'}
            </T>
          </Row>
        </StackPage>
        <MyStatusPage />
      </SmartStack>

      {/* The things you do most, one tap away (like app icons). */}
      <Row gap={space.xs} style={{ alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: WIDGET_GAP }}>
        <VividAction testID="qa-steps" icon={Footprints} label="Steps" color="green" style={{ flex: 1 }} onPress={() => router.push('/log-steps')} />
        <VividAction testID="qa-mood" icon={Smile} label="Mood" color="amber" style={{ flex: 1 }} onPress={() => router.push('/log-mood')} />
        <VividAction ref={mealTile} testID="qa-meal" icon={UtensilsCrossed} label="Meal" color="orange" style={{ flex: 1 }} onPress={() => setMealOpen(true)} />
        <VividAction testID="qa-note" icon={Mail} label="Surat" color="blue" style={{ flex: 1 }} onPress={() => router.push('/notes')} />
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

      {/* Steps and mood: two small widgets. */}
      <WidgetRow>
        <Widget size="small" fill="green" testID="log-steps" onPress={() => router.push('/log-steps')} accessibilityLabel={`Steps today: ${(day?.steps ?? 0).toLocaleString()} of ${goal.toLocaleString()}. Log steps`}>
          <WidgetCaption icon={Footprints} label="Steps" fill="green" right={share?.steps ? <Eye color="rgba(255,255,255,0.85)" size={13} /> : <Lock color="rgba(255,255,255,0.85)" size={12} />} />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <WidgetRing pct={stepsPct} size={58} stroke={8}>
              <T color="#FFFFFF" style={{ fontSize: 13, lineHeight: 16, fontWeight: '800' }}>
                {Math.round(Math.min(1, stepsPct) * 100)}%
              </T>
            </WidgetRing>
          </View>
          <WidgetValue color="#FFFFFF" size={26}>
            {(day?.steps ?? 0).toLocaleString()}
          </WidgetValue>
          <T color="rgba(255,255,255,0.85)" numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, fontWeight: '600' }}>
            of {goal.toLocaleString()}
          </T>
        </Widget>
        <Widget size="small" fill="amber" testID={day?.mood ? 'open-mood' : 'log-mood'} onPress={() => router.push('/log-mood')} accessibilityLabel={day?.mood ? `Mood: ${day.mood.label}. Update` : 'Check in your mood'}>
          <WidgetCaption icon={Smile} label="Mood" fill="amber" right={share?.mood ? <Eye color="rgba(255,255,255,0.85)" size={13} /> : <Lock color="rgba(255,255,255,0.85)" size={12} />} />
          {day?.mood ? (
            <>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                {day.mood.media?.type === 'photo' ? (
                  <View style={{ width: 58, height: 58, borderRadius: 29, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF' }}>
                    <StoredPrivateImage path={day.mood.media.path} size={54} alt="Your mood selfie" />
                  </View>
                ) : (
                  <T style={{ fontSize: 46, lineHeight: 56 }} accessibilityElementsHidden>
                    {day.mood.emoji}
                  </T>
                )}
              </View>
              <T testID="my-mood" color="#FFFFFF" numberOfLines={1} style={{ fontSize: 20, lineHeight: 24, fontWeight: '800' }}>
                {day.mood.label}
              </T>
              <T color="rgba(255,255,255,0.88)" numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, fontWeight: '600' }}>
                Stress: {STRESS_LABELS[day.mood.stress].toLowerCase()}
              </T>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }} />
              <T color="#FFFFFF" style={{ fontSize: 20, lineHeight: 24, fontWeight: '800' }}>
                How are you?
              </T>
              <T color="rgba(255,255,255,0.88)" style={{ fontSize: 12, lineHeight: 15, fontWeight: '600' }}>
                Tap to check in
              </T>
            </>
          )}
        </Widget>
      </WidgetRow>

      {/* Us: how today is going, and a word from your partner. */}
      <Widget fill="surface" style={{ marginBottom: WIDGET_GAP }} onPress={() => router.push('/their-day')} accessibilityLabel={`Today. ${partnerLine ? `${partnerName}: ${partnerLine}` : `Nothing from ${partnerName} yet today.`} Open ${partnerName}’s day`}>
        <Row gap={space.md} style={{ alignItems: 'center', flex: 1 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <WidgetCaption icon={Heart} label="Today" color={c.heart} />
            <T testID="summary-line" variant="heading" style={{ fontSize: 18, lineHeight: 23 }}>
              {ready ? summaryLine(day?.steps, day?.mood?.stress) : ' '}
            </T>
            {streakText ? (
              <T variant="small" muted style={{ fontSize: 13, lineHeight: 17 }}>
                {streakText}
              </T>
            ) : null}
            <T testID="partner-line" variant="small" style={{ fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
              {partnerLine ? `${partnerName}: ${partnerLine}` : `Nothing from ${partnerName} yet today.`}
            </T>
          </View>
          <CoupleArt size={92} />
        </Row>
      </Widget>

      {/* To-dos and meals. */}
      <WidgetRow>
        <Widget size="small" fill="surface" testID="open-todos" onPress={() => router.push('/todos')} accessibilityLabel={`To-dos today: ${openTodos.length} left. Open`}>
          <WidgetCaption icon={ListChecks} label="To-dos" color={vivid.blue[1]} />
          <WidgetValue color={c.text} size={30}>
            {todosReady ? openTodos.length : ' '}
          </WidgetValue>
          <View style={{ flex: 1, gap: 5, marginTop: 2 }}>
            {openTodos.slice(0, 2).map((t) => (
              <Row key={t.id} gap={6}>
                <Circle color={vivid.blue[1]} size={13} strokeWidth={2.4} />
                <T numberOfLines={1} style={{ flex: 1, fontSize: 13, lineHeight: 17 }}>
                  {t.text}
                </T>
              </Row>
            ))}
            {todosReady && openTodos.length === 0 ? (
              <T muted style={{ fontSize: 13, lineHeight: 17 }}>
                Nothing for today
              </T>
            ) : null}
          </View>
        </Widget>
        <Widget size="small" fill="orange" testID="add-meal" onPress={() => setMealOpen(true)} accessibilityLabel={`Meals today: ${mealsToday.length}. Add one`}>
          <WidgetCaption icon={UtensilsCrossed} label="Meals" fill="orange" right={share?.food ? <Eye color="rgba(255,255,255,0.85)" size={13} /> : <Lock color="rgba(255,255,255,0.85)" size={12} />} />
          <WidgetValue color="#FFFFFF" size={30}>
            {mealsToday.length}
          </WidgetValue>
          <View style={{ flex: 1 }}>
            <T color="rgba(255,255,255,0.92)" numberOfLines={3} style={{ fontSize: 13, lineHeight: 17, fontWeight: '600' }}>
              {lastMeal ? `Last: ${lastMeal.text}` : 'Nothing logged yet. Tap to add.'}
            </T>
          </View>
          <Row style={{ alignSelf: 'flex-end', width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' }}>
            <Plus color="#FFFFFF" size={17} strokeWidth={2.8} />
          </Row>
        </Widget>
      </WidgetRow>

      {/* A Malay riddle, new every 30 minutes. */}
      <TekaTekiCard />

      {/* Find each other, and a calm place. */}
      <WidgetRow>
        <Widget size="small" fill="teal" testID="open-find" onPress={() => router.push('/find')} accessibilityLabel={`Find ${partnerName}`}>
          <WidgetCaption icon={MapPin} label="Find" fill="teal" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
              <Navigation color="#FFFFFF" fill="#FFFFFF" size={22} />
            </View>
          </View>
          <T color="#FFFFFF" numberOfLines={1} style={{ fontSize: 18, lineHeight: 22, fontWeight: '800' }}>
            {partnerName}
          </T>
          <T color="rgba(255,255,255,0.88)" numberOfLines={2} style={{ fontSize: 12, lineHeight: 15, fontWeight: '600' }}>
            See where you both are
          </T>
        </Widget>
        <Widget size="small" fill="violet" testID="open-calm" onPress={() => router.push('/calm')} accessibilityLabel="Calm Corner: breathe, soft sounds, or a private vent">
          <WidgetCaption icon={Wind} label="Calm Corner" fill="violet" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.45)' }} />
            </View>
          </View>
          <T color="#FFFFFF" numberOfLines={1} style={{ fontSize: 18, lineHeight: 22, fontWeight: '800' }}>
            Breathe
          </T>
          <T color="rgba(255,255,255,0.88)" numberOfLines={2} style={{ fontSize: 12, lineHeight: 15, fontWeight: '600' }}>
            Two calm minutes
          </T>
        </Widget>
      </WidgetRow>

      {cycleSettings?.enabled && cycle ? (
        <Widget fill="pink" style={{ marginBottom: WIDGET_GAP }} onPress={() => router.push('/cycle')} accessibilityLabel={`${PHASE_LABEL[cycle.phase]}, day ${cycle.day}. Open your cycle`}>
          <WidgetCaption icon={CalendarHeart} label="Cycle" fill="pink" />
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <WidgetValue color="#FFFFFF" size={28}>
              Day {cycle.day}
            </WidgetValue>
            <T color="#FFFFFF" style={{ fontSize: 15, lineHeight: 19, fontWeight: '700' }}>
              {PHASE_LABEL[cycle.phase]}
            </T>
            <T color="rgba(255,255,255,0.88)" numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, fontWeight: '600' }}>
              {predictionLine(cycle)}
              {cycle.symptoms.length ? ` · ${cycle.symptoms.join(', ').toLowerCase()}` : ''}
            </T>
          </View>
        </Widget>
      ) : null}

      {/* The evening check-in comes out in the evening (or once you've answered). */}
      {evening || answered ? (
        <Widget fill="ink" style={{ marginBottom: WIDGET_GAP }} testID="open-checkin" onPress={() => router.push('/check-in')} accessibilityLabel={answered ? 'See tonight’s moment' : 'Evening check-in: answer'}>
          <WidgetCaption icon={Moon} label="Evening check-in" fill="ink" color="#C9B8FF" />
          <View style={{ flex: 1, justifyContent: 'flex-end', gap: 4 }}>
            {answered ? (
              <T testID="checkin-summary" color="#FFFFFF" numberOfLines={2} style={{ fontSize: 17, lineHeight: 22, fontWeight: '700' }}>
                {day?.checkIn?.text ? `\u201C${day.checkIn.text}\u201D` : 'You saved a voice moment tonight.'}
              </T>
            ) : (
              <T color="#FFFFFF" style={{ fontSize: 17, lineHeight: 22, fontWeight: '700' }}>
                What was one good moment today?
              </T>
            )}
            <T color="rgba(255,255,255,0.7)" style={{ fontSize: 12, lineHeight: 16, fontWeight: '600' }}>
              {answered ? 'Tap to see tonight’s moment' : 'Tap to answer'}
            </T>
          </View>
        </Widget>
      ) : null}

      {!cycleSettings?.enabled ? <Button kind="ghost" small label="Track your cycle (optional, private)" onPress={() => router.push('/cycle')} /> : null}
    </Screen>
  );
}
