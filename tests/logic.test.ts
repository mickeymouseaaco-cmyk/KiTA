/// <reference types="node" />
/** Unit tests for Together's pure logic. Run: npm run test:unit */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { QUICK_MESSAGES, empty, summaryLine } from '../src/lib/copy';
import { dayKey, lastNDays } from '../src/lib/dates';
import { projectDay } from '../src/lib/projection';
import { CHEERS, DEFAULT_TARGET, NAME_MAX, cheerFor, nameSize, stressAfter, targetName } from '../src/lib/smash-pure';
import { normalizeFlight, pickAircraft, toPosition, toRoute } from '../functions/src/flight-pure';
import { cleanFlightNo, compass, etaWords, fr24Url, mapSpan, phaseWord, prettyFlightNo, routeProgress } from '../src/lib/flight-pure';
import { coupleTips, rangeBar, skyColors, skyLayers, skyLines, timeOfDay, hourInMalaysia } from '../src/lib/sky-pure';
import { parseCurrent } from '../src/lib/flood-pure';
import { mapsUrl, parseTime, sortStops, stopsByDay, timeLabel } from '../src/lib/itinerary-pure';
import { showTimeFlags } from '../src/lib/note-groups';
import { gentleAlert, isHighSteps, suggestionsFor } from '../src/lib/suggestions';
import { DEFAULT_SHARE, type DailyLog } from '../src/lib/types';
import { dayKeyIn, hashStepsToken, newStepsToken, parseSteps, syncDay } from '../functions/src/steps-pure';

const day: DailyLog = {
  date: '2026-11-09',
  steps: 9000,
  stepGoal: 8000,
  mood: { emoji: '😢', label: 'Sad', stress: 4, note: 'rough meeting' },
};

describe('projectDay (what the partner may see)', () => {
  test('defaults: steps shared, mood private', () => {
    const p = projectDay('me', day, DEFAULT_SHARE);
    assert.equal(p.steps, 9000);
    assert.equal(p.mood, undefined);
  });

  test('mood shared only when toggled on, without the private timestamp', () => {
    const p = projectDay('me', { ...day, mood: { ...day.mood!, at: 'x' as never } }, { ...DEFAULT_SHARE, mood: true });
    assert.deepEqual(p.mood, { emoji: '😢', label: 'Sad', stress: 4, note: 'rough meeting' });
  });

  test('nothing shared when everything is off', () => {
    const off = { steps: false, mood: false, food: false, cycle: false, media: false };
    assert.deepEqual(projectDay('me', day, off), { ownerId: 'me', date: '2026-11-09' });
  });

  test('cycle and mood are private by default', () => {
    assert.equal(DEFAULT_SHARE.mood, false);
    assert.equal(DEFAULT_SHARE.cycle, false);
  });
});

describe('support suggestions', () => {
  test('high stress brings calming ideas and a gentle alert', () => {
    const shared = { ownerId: 'p', date: day.date, mood: { emoji: '😢', label: 'Sad', stress: 5 as const } };
    const ids = suggestionsFor('Blair', shared).map((s) => s.id);
    assert.ok(ids.includes('no-phone'));
    assert.ok(ids.includes('massage'));
    assert.equal(gentleAlert('Blair', shared)?.kind, 'stress');
  });

  test('very high steps suggest rest', () => {
    const shared = { ownerId: 'p', date: day.date, steps: 18000, stepGoal: 8000 };
    assert.ok(isHighSteps(shared));
    assert.ok(suggestionsFor('Blair', shared).some((s) => s.id === 'bath'));
    assert.equal(gentleAlert('Blair', shared)?.kind, 'steps');
  });

  test('nothing shared still gives kind defaults, and no alert', () => {
    const list = suggestionsFor('Blair', undefined);
    assert.ok(list.length >= 2);
    assert.equal(gentleAlert('Blair', undefined), null);
  });

  test('never more than five ideas, no duplicates', () => {
    const shared = { ownerId: 'p', date: day.date, steps: 20000, stepGoal: 8000, mood: { emoji: '😤', label: 'Frustrated', stress: 5 as const } };
    const list = suggestionsFor('Blair', shared);
    assert.ok(list.length <= 5);
    assert.equal(new Set(list.map((s) => s.id)).size, list.length);
  });
});

describe('tone', () => {
  const banned = /\b(fail|failed|failure|missed|behind|bad|should have|warning|error)\b/i;

  test('summary lines are kind at every step count', () => {
    for (const steps of [undefined, 0, 1200, 6000, 9000, 25000]) {
      for (const stress of [undefined, 1, 5]) {
        const line = summaryLine(steps, stress);
        assert.ok(line.length > 0);
        assert.doesNotMatch(line, banned, line);
      }
    }
    assert.equal(summaryLine(9000), 'You walked 9,000 steps today. Be gentle with yourself.');
  });

  test('empty states and quick messages carry no shame words', () => {
    const lines = [...Object.values(empty).map((v) => (typeof v === 'function' ? v('Blair') : v)), ...QUICK_MESSAGES];
    for (const l of lines) assert.doesNotMatch(l, banned, l);
  });
});

describe('dates', () => {
  test('lastNDays ends today, oldest first', () => {
    const d = lastNDays(7);
    assert.equal(d.length, 7);
    assert.equal(d[6], dayKey());
    assert.ok(d[0] < d[6]);
  });
});

// ---------------------------------------------------------------- Phase 2

import { cycleToday, partnerCycleTips, phaseFor, predictionLine } from '../src/lib/cycle';
import { weeklyAppreciation } from '../src/lib/gratitude-summary';

describe('cycle', () => {
  const s = { enabled: true, lastStart: '2026-11-01', cycleLength: 28, periodLength: 5 };

  test('phases across a 28-day cycle', () => {
    assert.equal(phaseFor(1, 28, 5), 'menstrual');
    assert.equal(phaseFor(5, 28, 5), 'menstrual');
    assert.equal(phaseFor(8, 28, 5), 'follicular');
    assert.equal(phaseFor(14, 28, 5), 'ovulation');
    assert.equal(phaseFor(20, 28, 5), 'luteal');
  });

  test('day number, wrap-around and prediction', () => {
    assert.deepEqual(cycleToday(s, '2026-11-01'), { phase: 'menstrual', day: 1, daysUntilNext: 28, symptoms: [] });
    assert.equal(cycleToday(s, '2026-11-29')?.day, 1); // next cycle
    const late = cycleToday(s, '2026-11-27')!;
    assert.equal(late.daysUntilNext, 2);
    assert.match(predictionLine(late), /about 2 days/);
  });

  test('disabled or future start shows nothing', () => {
    assert.equal(cycleToday({ ...s, enabled: false }, '2026-11-05'), null);
    assert.equal(cycleToday(s, '2026-10-20'), null);
  });

  test('partner tips follow phase and symptoms', () => {
    const tips = partnerCycleTips('Alex', { phase: 'menstrual', day: 2, daysUntilNext: 27, symptoms: ['Cramps', 'Tired'] });
    const ids = tips.map((t) => t.id);
    assert.ok(ids.includes('warm'));
    assert.ok(ids.includes('chores'));
    assert.ok(tips.length <= 4);
  });
});

describe('Phase 2 sharing', () => {
  const full: DailyLog = {
    date: '2026-11-09',
    food: { meals: [{ id: 'a', kind: 'lunch', text: 'Soup', at: 1 }], water: 3 },
    cycle: { phase: 'luteal', day: 20, daysUntilNext: 9, symptoms: ['Moody'] },
    checkIn: { text: 'private good moment' },
  };

  test('food is shared by default without ids or times; cycle is not', () => {
    const p = projectDay('me', full, DEFAULT_SHARE);
    assert.deepEqual(p.food, { meals: [{ kind: 'lunch', text: 'Soup' }], water: 3 });
    assert.equal(p.cycle, undefined);
  });

  test('cycle shared only when on; check-ins never', () => {
    const p = projectDay('me', full, { ...DEFAULT_SHARE, cycle: true });
    assert.equal(p.cycle?.phase, 'luteal');
    assert.equal(JSON.stringify(p).includes('private good moment'), false);
  });
});

describe('gratitude summary', () => {
  const week = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];
  test('counts both directions and stays warm', () => {
    const items = [
      { ownerId: 'me', date: '2026-11-09' },
      { ownerId: 'them', date: '2026-11-09' },
      { ownerId: 'them', date: '2026-11-04' },
      { ownerId: 'them', date: '2026-10-01' }, // outside the week
    ];
    const s = weeklyAppreciation(items, 'me', 'Blair', week);
    assert.equal(s.mine, 1);
    assert.equal(s.theirs, 2);
    assert.match(s.line, /thanked each other 3 times/);
  });
  test('an empty week is a fresh start, not a failure', () => {
    assert.match(weeklyAppreciation([], 'me', 'Blair', week).line, /fresh week/);
  });
});

// ---------------------------------------------------------------- Phase 3

import { DATE_IDEAS, daysUntil, matchingIdeas, nextOccurrence, pickIdea, planningPrompt } from '../src/lib/ideas';
import { suggestionsFor as suggest } from '../src/lib/suggestions';
import { coupleStreak, plantStage } from '../src/lib/together-data-pure';
import { countdownLine, miniTaskFor, moodRecap, packingFor, suggestRestDays, tripPhase, weatherFromChoice } from '../src/lib/trip-logic';

describe('trips', () => {
  test('countdown and phases', () => {
    assert.equal(countdownLine('2026-11-20', '2026-11-25', '2026-11-09'), '11 days to go');
    assert.equal(countdownLine('2026-11-10', '2026-11-12', '2026-11-09'), 'Tomorrow!');
    assert.equal(tripPhase('2026-11-01', '2026-11-12', '2026-11-09'), 'during');
    assert.match(countdownLine('2026-11-01', '2026-11-12', '2026-11-09'), /Day 9/);
  });
  test('one small mini task for every day, none with pressure words', () => {
    for (let d = 0; d <= 60; d++) {
      const t = miniTaskFor(d);
      assert.ok(t.length > 0);
      assert.doesNotMatch(t, /overdue|late|must|failed/i);
    }
  });
  test('packing adapts to the weather', () => {
    const hot = packingFor(weatherFromChoice('hot', 6));
    assert.ok(hot.includes('Sunscreen') && hot.includes('Swimsuit') && hot.includes('Small laundry bag'));
    assert.ok(!hot.includes('Warm coat, hat and gloves'));
    const cold = packingFor(weatherFromChoice('cold', 3));
    assert.ok(cold.includes('Warm coat, hat and gloves'));
    assert.ok(packingFor(weatherFromChoice('rainy', 4)).includes('Rain jacket or umbrella'));
  });
  test('rest days: about one in four, never on the last day', () => {
    assert.deepEqual(suggestRestDays('2026-12-01', '2026-12-02'), []);
    assert.deepEqual(suggestRestDays('2026-12-01', '2026-12-10'), ['2026-12-04', '2026-12-08']);
  });
  test('trip mood recap counts and sorts', () => {
    assert.deepEqual(moodRecap(['😍', '😊', '😍', undefined]), [
      { emoji: '😍', count: 2 },
      { emoji: '😊', count: 1 },
    ]);
  });
});

describe('date ideas & milestones', () => {
  test('filters by budget ceiling, energy and time', () => {
    const free = matchingIdeas({ budget: 0, energy: 'cozy' });
    assert.ok(free.length > 0);
    assert.ok(free.every((i) => i.budget === 0 && i.energy === 'cozy'));
  });
  test('never repeats the idea just shown', () => {
    const first = pickIdea({}, undefined, () => 0)!;
    const second = pickIdea({}, first.id, () => 0)!;
    assert.notEqual(first.id, second.id);
    assert.equal(DATE_IDEAS.length > 15, true);
  });
  test('yearly milestones roll over to next year', () => {
    assert.equal(nextOccurrence('2021-06-14', true, '2026-11-09'), '2027-06-14');
    assert.equal(nextOccurrence('2021-11-09', true, '2026-11-09'), '2026-11-09');
    assert.equal(nextOccurrence('2026-01-01', false, '2026-11-09'), null);
    assert.equal(daysUntil('2026-11-16', '2026-11-09'), 7);
    assert.match(planningPrompt('anniversary', 7), /Book a table/);
  });
});

describe('love languages, plant, streaks', () => {
  test('love language ideas come first', () => {
    const list = suggest('Blair', undefined, ['service', 'touch']);
    assert.equal(list[0].id, 'll-service');
    assert.equal(list[1].id, 'll-touch');
  });
  test('the plant only grows through stages', () => {
    assert.equal(plantStage(0).name, 'Seed');
    assert.equal(plantStage(5).name, 'Sprout');
    assert.equal(plantStage(200).name, 'Flourishing');
    assert.equal(plantStage(200).next, null);
  });
  test('couple streak needs both people, and today in progress does not break it', () => {
    const keys = ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];
    const days = { '2026-11-06': ['a'], '2026-11-07': ['a', 'b'], '2026-11-08': ['b', 'a'], '2026-11-09': ['a'] };
    assert.equal(coupleStreak(days, ['a', 'b'], keys), 2);
    assert.equal(coupleStreak({ ...days, '2026-11-09': ['a', 'b'] }, ['a', 'b'], keys), 3);
  });
});

import { dueDateFor, isForMe, sortTodos, todayList, todoBucket, whenFor, type Todo } from '../src/lib/todos-pure';
import { balanceLine, freeSlots, planSummary, plansIn, upcomingWeekend } from '../src/lib/weekend-pure';

const todo = (over: Partial<Todo>): Todo => ({ id: 'x', text: 'x', forUid: 'both', dueDate: null, important: false, done: false, addedBy: 'a', ...over });

describe('shared to-dos (gentle, never overdue)', () => {
  test('"this week" means by the coming Sunday; today and someday as expected', () => {
    const tue = new Date(2026, 10, 10); // Tuesday 10 Nov 2026
    assert.equal(dueDateFor('today', tue), '2026-11-10');
    assert.equal(dueDateFor('week', tue), '2026-11-15');
    assert.equal(dueDateFor('someday', tue), null);
    // On a Sunday, "this week" rolls to the next Sunday rather than today.
    assert.equal(dueDateFor('week', new Date(2026, 10, 15)), '2026-11-22');
  });

  test('anything due earlier simply shows under Today, with no "late" bucket', () => {
    assert.equal(todoBucket({ done: false, dueDate: '2026-11-01' }, '2026-11-10'), 'today');
    assert.equal(todoBucket({ done: false, dueDate: '2026-11-12' }, '2026-11-10'), 'soon');
    assert.equal(todoBucket({ done: false, dueDate: null }, '2026-11-10'), 'someday');
    assert.equal(todoBucket({ done: true, dueDate: '2026-11-01' }, '2026-11-10'), 'done');
    assert.equal(whenFor('2026-11-01', '2026-11-10'), 'today');
  });

  test('important first, then soonest, done last', () => {
    const list = sortTodos([
      todo({ id: 'done', done: true, important: true }),
      todo({ id: 'someday' }),
      todo({ id: 'soon', dueDate: '2026-11-12' }),
      todo({ id: 'star', important: true, dueDate: '2026-11-14' }),
    ]);
    assert.deepEqual(list.map((t) => t.id), ['star', 'soon', 'someday', 'done']);
  });

  test("today's list is mine or shared, open, and due by today", () => {
    const list = [
      todo({ id: 'mine', forUid: 'a', dueDate: '2026-11-10' }),
      todo({ id: 'both', dueDate: '2026-11-09' }),
      todo({ id: 'theirs', forUid: 'b', dueDate: '2026-11-10' }),
      todo({ id: 'later', forUid: 'a', dueDate: '2026-11-12' }),
      todo({ id: 'ticked', forUid: 'a', dueDate: '2026-11-10', done: true }),
    ];
    assert.deepEqual(todayList(list, 'a', '2026-11-10').map((t) => t.id).sort(), ['both', 'mine']);
    assert.equal(isForMe(todo({ forUid: 'b' }), 'a'), false);
  });
});

describe('weekend planner', () => {
  test('plans the coming weekend, or this one while it is happening', () => {
    assert.deepEqual(upcomingWeekend(new Date(2026, 10, 10)), ['2026-11-14', '2026-11-15']); // Tuesday
    assert.deepEqual(upcomingWeekend(new Date(2026, 10, 14)), ['2026-11-14', '2026-11-15']); // Saturday
    assert.deepEqual(upcomingWeekend(new Date(2026, 10, 15)), ['2026-11-14', '2026-11-15']); // Sunday
    assert.deepEqual(upcomingWeekend(new Date(2026, 10, 16)), ['2026-11-21', '2026-11-22']); // Monday
  });

  test('counts free slots and nudges kindly toward rest', () => {
    const days = ['2026-11-14', '2026-11-15'];
    const plans = [
      { date: '2026-11-14', slot: 'morning' as const, text: 'Slow breakfast' },
      { date: '2026-11-14', slot: 'morning' as const, text: 'Market' },
      { date: '2026-11-15', slot: 'evening' as const, text: 'Mum’s dinner' },
    ];
    assert.equal(freeSlots(plans, days), 4);
    assert.equal(plansIn(plans, '2026-11-14', 'morning').length, 2);
    assert.match(balanceLine(0, 6), /keep one empty/);
    assert.match(balanceLine(6, 6), /Rest is a plan too/);
    const summary = planSummary(plans, days);
    assert.match(summary, /Slow breakfast, Market/);
    assert.match(summary, /Mum’s dinner/);
  });

  test('to-do and weekend copy stays gentle', () => {
    const lines = [empty.todos, empty.todosToday, empty.weekendSlot, empty.starred, balanceLine(0, 6), balanceLine(3, 6)];
    for (const l of lines) assert.doesNotMatch(l, /overdue|late|failed|missed|must/i);
  });
});

import { AREAS, threadsSearchUrl, floodStatus, isActive, isFresh, myTime, parseForecast, parseStations, rainRisk, riverLevel, warningsFor, weatherWords, worst, SAFETY_TIPS, LEVEL_LABEL, type Warning } from '../src/lib/flood-pure';

describe('weather & flood watch (Shah Alam, Klang)', () => {
  const shahAlam = AREAS[0];
  const klang = AREAS[1];
  const now = Date.parse('2026-11-10T12:00:00+08:00');
  const day = (over: object = {}) => ({ date: '2026-11-10', minC: 24, maxC: 32, rainMm: 0, rainChance: 10, maxHourlyMm: 0, code: 1, ...over });
  const warn = (over: Partial<Warning> = {}): Warning => ({ title: 'Thunderstorm warning', heading: '', text: '', instruction: '', validFrom: '2026-11-10 10:00:00', validTo: '2026-11-10 18:00:00', issued: '2026-11-10 09:50:00', ...over });

  test('parses the Open-Meteo forecast, including the heaviest hour of rain', () => {
    const days = parseForecast({
      daily: { time: ['2026-11-10', '2026-11-11'], temperature_2m_max: [32.4, 31], temperature_2m_min: [24.2, 24], precipitation_sum: [41.27, 2], precipitation_probability_max: [90, 30], weather_code: [95, 3] },
      hourly: { time: ['2026-11-10T15:00', '2026-11-10T16:00', '2026-11-11T09:00'], precipitation: [12.5, 33.1, 1] },
    });
    assert.equal(days.length, 2);
    assert.equal(days[0].maxHourlyMm, 33.1);
    assert.equal(days[0].rainMm, 41.3);
    assert.equal(rainRisk(days[0]), 3);
    assert.equal(rainRisk(days[1]), 0);
    assert.equal(weatherWords(95), 'Thunderstorms');
  });

  test('MET times are Malaysia time; expired warnings are ignored', () => {
    assert.equal(myTime('2026-11-10 12:00:00'), now);
    assert.equal(isActive(warn(), now), true);
    assert.equal(isActive(warn({ validTo: '2026-11-10 11:00:00' }), now), false);
  });

  test('warnings that name the area are local; Selangor-wide ones are kept separately', () => {
    const all = [
      warn({ text: 'Thunderstorms and heavy rain over Selangor (Petaling, Klang, Hulu Langat)' }),
      warn({ title: 'Strong winds', text: 'Selangor coast' }),
      warn({ text: 'Johor (Kluang)' }),
    ];
    assert.equal(warningsFor(shahAlam, all, now).local.length, 1);
    assert.equal(warningsFor(shahAlam, all, now).state.length, 1);
    assert.equal(warningsFor(klang, all, now).local.length, 1);
  });

  test('river readings: thresholds decide the level, and stale readings are never shown as live', () => {
    const [s] = parseStations([
      { station_name: 'Sg. Klang di Jambatan Petaling', district: 'Petaling', state: 'Selangor', water_level_current: '6.2', water_level_normal_level: 4, water_level_alert_level: 5.5, water_level_warning_level: 6, water_level_danger_level: 7, water_level_update_datetime: '2026-11-10 11:30:00' },
    ]);
    assert.equal(riverLevel(s), 'warning');
    assert.equal(isFresh(s, now), true);
    assert.equal(isFresh({ updated: '2024-02-23 10:00:00' }, now), false);
    assert.equal(isFresh({ updated: null }, now), false);
  });

  test('status: a calm day, a heavy-rain watch, and a real warning', () => {
    assert.equal(floodStatus(shahAlam, { days: [day()], warnings: [], stations: [] }, now).level, 'calm');
    const watch = floodStatus(shahAlam, { days: [day({ maxHourlyMm: 35, rainMm: 50 })], warnings: [], stations: [] }, now);
    assert.equal(watch.level, 'watch');
    assert.match(watch.reasons.join(' '), /Very heavy rain possible today/);
    const stale = parseStations([{ station_name: 'Old', district: 'Klang', state: 'Selangor', water_level_current: 9, water_level_danger_level: 7, water_level_update_datetime: '2024-02-23 10:00:00' }]);
    assert.equal(floodStatus(klang, { days: [day()], warnings: [], stations: stale }, now).level, 'calm');
    const real = floodStatus(klang, { days: [day()], warnings: [warn({ text: 'Continuous rain: Selangor (Klang, Kuala Langat)' })], stations: [] }, now);
    assert.equal(real.level, 'warning');
    assert.equal(worst(['calm', 'watch']), 'watch');
  });

  test('flood copy is calm and clear, never shaming', () => {
    const lines = [...Object.values(LEVEL_LABEL), ...SAFETY_TIPS.calm, ...SAFETY_TIPS.watch];
    for (const l of lines) assert.doesNotMatch(l, /failed|you should have|panic/i);
    assert.match(SAFETY_TIPS.warning.join(' '), /999/);
  });
});

describe('Threads links for local flood posts', () => {
  test('each area has Threads searches, and links are properly encoded', () => {
    for (const a of AREAS) assert.ok(a.threads.length >= 2, a.name);
    assert.ok(AREAS[0].threads.some((s) => /i-City/.test(s.query)));
    assert.equal(threadsSearchUrl('banjir i-City'), 'https://www.threads.com/search?q=banjir%20i-City&serp_type=default');
  });
});

describe('steps from iPhone (functions/src/steps-pure.ts)', () => {
  test('reads step counts however the phone formats them', () => {
    assert.equal(parseSteps('8412'), 8412);
    assert.equal(parseSteps('8,412'), 8412);
    assert.equal(parseSteps('8.412'), 8412);
    assert.equal(parseSteps('8 412'), 8412);
    assert.equal(parseSteps('8412.0'), 8412);
    assert.equal(parseSteps('8412,6'), 8413);
    assert.equal(parseSteps(' 12,345 '), 12345);
    assert.equal(parseSteps(9001.4), 9001);
    assert.equal(parseSteps('0'), 0);
  });
  test('refuses anything that is not a believable step count', () => {
    for (const bad of ['', 'abc', '-5', '1e9', '200000', '12,345,678', undefined, null, {}, NaN, -1]) assert.equal(parseSteps(bad), null, String(bad));
  });
  test('links are long, random and looked up by hash', () => {
    const a = newStepsToken();
    const b = newStepsToken();
    assert.match(a, /^[A-Za-z0-9_-]{32}$/);
    assert.notEqual(a, b);
    assert.equal(hashStepsToken(a), hashStepsToken(a));
    assert.notEqual(hashStepsToken(a), a);
    assert.match(hashStepsToken(a), /^[0-9a-f]{64}$/);
  });
  test('steps land on today in Malaysia, or yesterday for a late sync', () => {
    const at = new Date('2026-11-10T17:30:00Z'); // 1:30 am on 11 Nov in Kuala Lumpur
    assert.equal(dayKeyIn('Asia/Kuala_Lumpur', at), '2026-11-11');
    assert.equal(syncDay(undefined, 'Asia/Kuala_Lumpur', at), '2026-11-11');
    assert.equal(syncDay('2026-11-10', 'Asia/Kuala_Lumpur', at), '2026-11-10');
    assert.equal(syncDay('2026-11-01', 'Asia/Kuala_Lumpur', at), '2026-11-11');
    assert.equal(syncDay('nonsense', 'Asia/Kuala_Lumpur', at), '2026-11-11');
  });
});

describe('weather at a glance', () => {
  test('sky kinds follow the weather code', async () => {
    const { skyKind } = await import('../src/lib/flood-pure');
    assert.equal(skyKind(0), 'sun');
    assert.equal(skyKind(2), 'partly');
    assert.equal(skyKind(3), 'cloud');
    assert.equal(skyKind(45), 'fog');
    assert.equal(skyKind(53), 'drizzle');
    assert.equal(skyKind(63), 'rain');
    assert.equal(skyKind(81), 'rain');
    assert.equal(skyKind(95), 'storm');
  });
  test('official warnings shrink to an icon, a few words and a level', async () => {
    const { warningBrief } = await import('../src/lib/flood-pure');
    const b = (title: string, validTo: string | null = null) => warningBrief({ title, heading: '', validTo });
    assert.deepEqual(
      { ...b('Continuous Rain Warning (Danger Level)', '2026-11-11 18:00:00') },
      { kind: 'rain', label: 'Non-stop rain', level: 'danger', untilMs: Date.parse('2026-11-11T18:00:00+08:00') },
    );
    assert.equal(b('Continuous Rain Warning (Alert Level)').level, 'alert');
    assert.equal(b('Continuous Rain Warning (Severe Level)').level, 'severe');
    assert.equal(b('Thunderstorms Warning').kind, 'storm');
    assert.equal(b('Thunderstorms Warning').level, 'advisory');
    assert.equal(b('Strong Wind and Rough Seas Warning (First Category)').kind, 'wind');
    assert.equal(b('Tropical Cyclone Warning').kind, 'cyclone');
    assert.equal(b('Amaran Ribut Petir').kind, 'storm');
    assert.equal(b('Something new').label, 'Bad weather');
  });
});

describe('question of the day', () => {
  test('both partners get the same question on the same day', async () => {
    const { questionFor } = await import('../src/lib/questions-pure');
    assert.deepEqual(questionFor('2026-11-10', 'coupleA'), questionFor('2026-11-10', 'coupleA'));
  });
  test('a new question each day, and it cycles through the whole list', async () => {
    const { QUESTIONS, questionFor } = await import('../src/lib/questions-pure');
    const seen = new Set<number>();
    const start = Date.parse('2026-01-01T00:00:00Z');
    for (let i = 0; i < QUESTIONS.length; i++) {
      const d = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const q = questionFor(d, 'coupleA');
      assert.equal(q.text, QUESTIONS[q.id]);
      seen.add(q.id);
    }
    assert.equal(seen.size, QUESTIONS.length, 'no repeats until every question has been asked');
    assert.notEqual(questionFor('2026-11-10', 'coupleA').id, questionFor('2026-11-11', 'coupleA').id);
  });
  test('questions are unique, short and friendly', async () => {
    const { QUESTIONS } = await import('../src/lib/questions-pure');
    assert.ok(QUESTIONS.length >= 50);
    assert.equal(new Set(QUESTIONS).size, QUESTIONS.length);
    for (const q of QUESTIONS) {
      assert.ok(q.endsWith('?'), q);
      assert.ok(q.length <= 90, q);
    }
  });
  test('status: answer first, then reveal', async () => {
    const { questionStatus } = await import('../src/lib/questions-pure');
    assert.equal(questionStatus(false, false), 'answer-first');
    assert.equal(questionStatus(false, true), 'partner-waiting');
    assert.equal(questionStatus(true, false), 'waiting-for-partner');
    assert.equal(questionStatus(true, true), 'both');
  });
});

describe('find my partner', () => {
  test('distance in plain words', async () => {
    const { distanceM, distanceWords } = await import('../src/lib/location-pure');
    const icity = { lat: 3.0657, lng: 101.4846 };
    const klang = { lat: 3.0449, lng: 101.4456 };
    const d = distanceM(icity, klang);
    assert.ok(d > 4000 && d < 5000, `i-City to Klang is about 4.9 km (got ${Math.round(d)})`);
    assert.equal(distanceWords(80), 'right next to each other');
    assert.equal(distanceWords(640), '640 m apart');
    assert.equal(distanceWords(4900), '4.9 km apart');
    assert.equal(distanceWords(32000), '32 km apart');
  });
  test('only sends when it matters (moved, or a few minutes passed)', async () => {
    const { worthSending } = await import('../src/lib/location-pure');
    const here = { lat: 3.0657, lng: 101.4846, accuracy: 20 };
    assert.equal(worthSending(null, here, 0), true);
    assert.equal(worthSending({ fix: here, at: 0 }, { ...here, lat: 3.06571 }, 60_000), false, 'a metre, a minute later');
    assert.equal(worthSending({ fix: here, at: 0 }, { ...here, lat: 3.0667 }, 60_000), true, '110 m away');
    assert.equal(worthSending({ fix: here, at: 0 }, here, 4 * 60_000), true, 'four minutes later');
  });
  test('coordinates from an iPhone Shortcut', async () => {
    const { parseCoord } = await import('../functions/src/steps-pure');
    assert.equal(parseCoord('3.065712', 90), 3.065712);
    assert.equal(parseCoord('3,065712', 90), 3.065712);
    assert.equal(parseCoord('-33.8688', 90), -33.8688);
    assert.equal(parseCoord(101.4846, 180), 101.4846);
    for (const bad of ['', 'abc', '91', '200.1', '1e3', '3.1.2', undefined, null]) assert.equal(parseCoord(bad, 90), null, String(bad));
  });
  test('map links point at the right place', async () => {
    const { mapLinks, osmEmbed } = await import('../src/lib/location-pure');
    const l = mapLinks(3.0657, 101.4846);
    assert.match(l.waze, /ll=3.0657,101.4846/);
    assert.match(l.google, /destination=3.0657,101.4846/);
    assert.match(osmEmbed(3.0657, 101.4846), /marker=3.0657,101.4846/);
  });
});

// ------------------------------------------------------------ Stress Smash

test('Stress Smash: the name is tidied, kept short, or defaults to Mr. Stress', () => {
  assert.equal(targetName('  Boss   Man  '), 'Boss Man');
  assert.equal(targetName('   '), DEFAULT_TARGET);
  assert.equal(targetName('x'.repeat(40)).length, NAME_MAX);
  assert.ok(nameSize('Ali') > nameSize('A very long name here'));
});

test('Stress Smash: the meter drops to zero over the bonks, and replays get a new message', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((h) => stressAfter(h, 5)), [100, 80, 60, 40, 20, 0]);
  assert.equal(stressAfter(9, 5), 0);
  assert.equal(cheerFor(0), 'There you go! Feeling better? 😂');
  assert.notEqual(cheerFor(0), cheerFor(1));
  assert.equal(cheerFor(CHEERS.length), cheerFor(0));
  assert.equal(cheerFor(-1), CHEERS[CHEERS.length - 1]);
});

// ------------------------------------------------------------ Love Notes times
test('Love Notes: one time per burst from the same person within an hour', () => {
  const t = (h: number, m = 0) => new Date(2026, 10, 11, h, m).getTime();
  // Newest first, as the list shows them.
  const items = [
    { from: 'a', at: t(10, 40) }, // newest of a burst → time
    { from: 'a', at: t(10, 5) },
    { from: 'a', at: t(9, 50) },
    { from: 'b', at: t(9, 45) }, // other person → time
    { from: 'b', at: t(8, 0) }, // more than an hour before → its own time
  ];
  assert.deepEqual(showTimeFlags(items), [true, false, false, true, true]);
  // A new day always starts a new burst.
  assert.deepEqual(showTimeFlags([{ from: 'a', at: t(0, 10) }, { from: 'a', at: new Date(2026, 10, 10, 23, 50).getTime() }]), [true, true]);
  assert.deepEqual(showTimeFlags([]), []);
});

// ------------------------------------------------------------ Trip itinerary
test('itinerary: friendly time typing', () => {
  assert.equal(parseTime(''), null);
  assert.equal(parseTime('9'), '09:00');
  assert.equal(parseTime('930'), '09:30');
  assert.equal(parseTime('9:30'), '09:30');
  assert.equal(parseTime('9.30pm'), '21:30');
  assert.equal(parseTime('2 PM'), '14:00');
  assert.equal(parseTime('12am'), '00:00');
  assert.equal(parseTime('12pm'), '12:00');
  assert.equal(parseTime('1430'), '14:30');
  assert.equal(parseTime('25:00'), 'invalid');
  assert.equal(parseTime('9:75'), 'invalid');
  assert.equal(parseTime('13pm'), 'invalid');
  assert.equal(parseTime('lunch'), 'invalid');
  assert.equal(timeLabel('14:30', 'en-US'), '2:30 PM');
});

test('itinerary: stops sorted by day and time, any-time ones last, others kept aside', () => {
  const at = (n: number) => ({ toMillis: () => n });
  const stops = [
    { id: 'lunch', day: '2026-12-01', time: '13:00', createdAt: at(1) },
    { id: 'anytime', day: '2026-12-01', time: null, createdAt: at(0) },
    { id: 'breakfast', day: '2026-12-01', time: '08:30', createdAt: at(2) },
    { id: 'day2', day: '2026-12-02', time: '10:00', createdAt: at(3) },
    { id: 'old', day: '2026-11-20', time: null, createdAt: at(4) },
  ];
  assert.deepEqual(sortStops(stops).map((s) => s.id), ['old', 'breakfast', 'lunch', 'anytime', 'day2']);
  const { byDay, other } = stopsByDay(stops, ['2026-12-01', '2026-12-02', '2026-12-03']);
  assert.deepEqual(byDay.get('2026-12-01')!.map((s) => s.id), ['breakfast', 'lunch', 'anytime']);
  assert.deepEqual(byDay.get('2026-12-03'), []);
  assert.deepEqual(other.map((s) => s.id), ['old']);
  assert.equal(mapsUrl('Time Out Market', 'Lisbon'), 'https://www.google.com/maps/search/?api=1&query=Time%20Out%20Market%2C%20Lisbon');
  assert.equal(mapsUrl('Belém, Lisbon', 'Lisbon'), 'https://www.google.com/maps/search/?api=1&query=Bel%C3%A9m%2C%20Lisbon');
});

// ------------------------------------------------------------ Flight tracking
test('flights: what you type becomes the callsign the plane broadcasts', () => {
  assert.deepEqual(normalizeFlight('mh 2520'), { flight: 'MH2520', callsigns: ['MAS2520', 'MH2520'] });
  assert.deepEqual(normalizeFlight('AK-6124')!.callsigns, ['AXM6124', 'AK6124']);
  assert.deepEqual(normalizeFlight('D7 0237')!.callsigns, ['XAX237', 'D7237', 'D70237']);
  assert.deepEqual(normalizeFlight('MAS2520')!.callsigns, ['MAS2520']);
  assert.deepEqual(normalizeFlight('ZZ12')!.callsigns, ['ZZ12']); // unknown airline: try it as typed
  assert.equal(normalizeFlight('hello'), null);
  assert.equal(normalizeFlight(''), null);
  assert.equal(normalizeFlight('MH 2520; DROP'), null);
  assert.equal(cleanFlightNo(' mh 2520 '), 'MH2520');
  assert.equal(cleanFlightNo('12345'), null);
  assert.equal(cleanFlightNo('penang'), null);
  assert.equal(prettyFlightNo('MH2520'), 'MH 2520');
  assert.equal(prettyFlightNo('MAS2520'), 'MAS 2520');
  assert.equal(prettyFlightNo('D7237'), 'D7 237');
});

test('flights: picks the right plane and tidies its position', () => {
  const list = [
    { flight: 'MAS2521 ', lat: 3, lon: 101 },
    { flight: 'MAS2520 ', r: '9M-MXA', t: 'B738', desc: 'BOEING 737-800', lat: 4.123456, lon: 100.987654, alt_baro: 36000, gs: 455.4, track: 44.6, baro_rate: 0, seen_pos: 2.2 },
    { flight: 'MAS2520 ' }, // no position: ignored
  ];
  const ac = pickAircraft(list, ['MAS2520', 'MH2520'])!;
  assert.deepEqual(toPosition(ac), {
    callsign: 'MAS2520', lat: 4.1235, lon: 100.9877, altFt: 36000, onGround: false, speedKts: 455, heading: 45, climbFpm: 0, seenSec: 2, reg: '9M-MXA', type: 'B738', typeName: 'BOEING 737-800',
  });
  assert.equal(pickAircraft(list, ['SIA1']), null);
  const ground = toPosition({ flight: 'AXM1', lat: 5.3, lon: 100.27, alt_baro: 'ground', gs: 12 });
  assert.equal(ground.onGround, true);
  assert.equal(ground.altFt, 0);
  assert.equal(phaseWord(ground), 'On the ground');
  assert.equal(phaseWord({ onGround: false, climbFpm: 1800, altFt: 9000, speedKts: 280 }), 'Climbing');
  assert.equal(phaseWord({ onGround: false, climbFpm: -1200, altFt: 9000, speedKts: 280 }), 'Descending');
  assert.equal(phaseWord({ onGround: false, climbFpm: 0, altFt: 36000, speedKts: 450 }), 'Cruising');
});

test('flights: route, progress and a rough landing time', () => {
  const route = toRoute({
    response: {
      flightroute: {
        callsign: 'MAS2520', callsign_icao: 'MAS2520', airline: { name: 'Malaysia Airlines' },
        origin: { iata_code: 'KUL', municipality: 'Kuala Lumpur', name: 'KLIA', latitude: 2.7456, longitude: 101.7099 },
        destination: { iata_code: 'PEN', municipality: 'Penang', name: 'Penang Intl', latitude: 5.2971, longitude: 100.2769 },
      },
    },
  })!;
  assert.equal(route.airline, 'Malaysia Airlines');
  assert.equal(route.from!.code, 'KUL');
  assert.equal(route.to!.city, 'Penang');
  assert.equal(toRoute({ response: 'unknown callsign' }), null);
  assert.equal(toRoute(null), null);

  const pos = { callsign: 'MAS2520', lat: 4.02, lon: 100.99, altFt: 30000, onGround: false, speedKts: 420, heading: 330, climbFpm: 0, seenSec: 1, reg: null, type: null, typeName: null };
  const pr = routeProgress(route, pos)!;
  assert.ok(pr.fraction > 0.4 && pr.fraction < 0.6, `about halfway (${pr.fraction})`);
  assert.ok(pr.remainingKm > 130 && pr.remainingKm < 190, `km left (${pr.remainingKm})`);
  assert.ok(pr.etaMin! >= 18 && pr.etaMin! <= 24, `eta (${pr.etaMin})`);
  // Nowhere near the route: no progress shown.
  assert.equal(routeProgress(route, { ...pos, lat: 35, lon: 139 }), null);
  assert.equal(routeProgress(null, pos), null);

  assert.equal(etaWords(25), 'about 25 min');
  assert.equal(etaWords(135), 'about 2 h 15 min');
  assert.equal(compass(0), 'north');
  assert.equal(compass(225), 'south-west');
  assert.equal(compass(359), 'north');
  assert.equal(fr24Url('MH2520', 'MAS2520'), 'https://www.flightradar24.com/MAS2520');
  assert.equal(fr24Url('MH2520'), 'https://www.flightradar24.com/data/flights/mh2520');
  assert.ok(mapSpan({ altFt: 36000, onGround: false }) > mapSpan({ altFt: 2000, onGround: false }));
});

// ------------------------------------------------------------ The living sky
test('sky: time of day near the equator, and the right sky for it', () => {
  assert.equal(timeOfDay(7), 'dawn');
  assert.equal(timeOfDay(12), 'day');
  assert.equal(timeOfDay(19), 'dusk');
  assert.equal(timeOfDay(22), 'night');
  assert.equal(timeOfDay(3), 'night');
  assert.equal(hourInMalaysia(Date.UTC(2026, 10, 11, 4, 30)), 12.5);
  assert.notDeepEqual(skyColors('sun', 'day'), skyColors('sun', 'night'));
  assert.deepEqual(skyColors('storm', 'day'), ['#2B3452', '#5D6886']);
  const night = skyLayers('sun', 'night');
  assert.equal(night.sun, false);
  assert.equal(night.moon, true);
  assert.ok(night.stars > 0);
  const storm = skyLayers('storm', 'day');
  assert.ok(storm.rain > 20 && storm.lightning && storm.darkClouds && !storm.sun);
  assert.equal(skyLayers('fog', 'day').fog, true);
  assert.ok(skyLines('rain', 'day', 30, 'Aina').length >= 3);
  assert.match(skyLines('sun', 'night', 30, 'Aina')[0], /stars/);
  assert.match(skyLines('sun', 'day', 35, 'Aina')[0], /Aina/);
});

test('sky: the weather right now is read safely', () => {
  assert.deepEqual(parseCurrent({ current: { temperature_2m: 29.6, apparent_temperature: 34.2, weather_code: 2, is_day: 1, relative_humidity_2m: 74, wind_speed_10m: 9.4 } } as never), {
    tempC: 30, feelsC: 34, code: 2, isDay: true, humidity: 74, windKmh: 9,
  });
  assert.equal(parseCurrent({} as never), null);
  assert.equal(parseCurrent({ current: { temperature_2m: null } } as never), null);
  assert.equal(parseCurrent({ current: { temperature_2m: 25, is_day: 0 } } as never)!.isDay, false);
});

test('sky: ideas for the two of you from the week', () => {
  const day = (date: string, o: Partial<{ minC: number; maxC: number; rainMm: number; rainChance: number; maxHourlyMm: number; code: number }> = {}) => ({
    date, minC: 24, maxC: 31, rainMm: 0, rainChance: 10, maxHourlyMm: 0, code: 1, ...o,
  });
  // 2026-11-11 is a Wednesday.
  const week = [
    day('2026-11-11', { rainMm: 30, rainChance: 90, maxHourlyMm: 18, code: 95 }),
    day('2026-11-12', { rainMm: 8, rainChance: 70 }),
    day('2026-11-13', { rainMm: 0, rainChance: 5, maxC: 30 }),
    day('2026-11-14', { rainMm: 12, rainChance: 80 }),
    day('2026-11-15', { rainMm: 1, rainChance: 20 }),
  ];
  const tips = coupleTips(week, 'Aina');
  assert.equal(tips[0].icon, 'home');
  assert.match(tips[0].text, /Aina/);
  assert.ok(tips.some((t) => t.icon === 'walk' && /Friday/.test(t.text)), JSON.stringify(tips));
  assert.ok(tips.some((t) => t.icon === 'weekend' && /Sunday/.test(t.text)), JSON.stringify(tips));
  assert.ok(tips.length <= 3);
  assert.deepEqual(coupleTips([], 'Aina'), []);
  const hot = coupleTips([day('2026-11-11', { maxC: 35 })], 'Aina');
  assert.ok(hot.some((t) => t.icon === 'hot'));

  assert.deepEqual(rangeBar({ minC: 24, maxC: 32 }, 24, 32), { from: 0, to: 1 });
  const mid = rangeBar({ minC: 26, maxC: 26 }, 24, 32);
  assert.ok(mid.to > mid.from, 'a single-temperature day still shows a sliver');
});
