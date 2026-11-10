/**
 * Question of the day: reading and saving answers.
 * Layout: couples/{cid}/questions/{date} (server-kept: who has answered) and
 * couples/{cid}/questions/{date}/answers/{uid} (each answer). Security rules only
 * let you open your partner's answer once yours is saved.
 */
import { Timestamp, collection, type DocumentData, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { ANSWER_MAX } from './questions-pure';

export * from './questions-pure';

export type Answer = { text: string; qid: number; at: Timestamp | null };
export type QuestionDay = { date: string; qid: number | null; answered: string[]; revealedAt?: Timestamp };

/** A day document as stored, with safe defaults for anything missing. */
function toDay(d: DocumentData): QuestionDay {
  return {
    date: String(d.date ?? ''),
    qid: typeof d.qid === 'number' ? d.qid : null,
    answered: Array.isArray(d.answered) ? (d.answered as string[]) : [],
    revealedAt: d.revealedAt,
  };
}

const dayRef = (cid: string, date: string) => doc(db, 'couples', cid, 'questions', date);
const answerRef = (cid: string, date: string, uid: string) => doc(db, 'couples', cid, 'questions', date, 'answers', uid);

/** Who has answered today. `undefined` while loading. */
export function useQuestionDay(cid: string | null, date: string): QuestionDay | null | undefined {
  const [day, setDay] = useState<QuestionDay | null | undefined>(undefined);
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      dayRef(cid, date),
      (s) => setDay(s.exists() ? toDay(s.data()) : null),
      () => setDay(null),
    );
  }, [cid, date]);
  return day;
}

/**
 * One answer. Pass `enabled: false` for your partner's until yours exists
 * (the rules would refuse anyway).
 */
export function useAnswer(cid: string | null, date: string, uid: string | null, enabled = true): Answer | null | undefined {
  const [a, setA] = useState<Answer | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!cid || !uid || !enabled) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const stop = onSnapshot(
      answerRef(cid, date, uid),
      (s) => setA(s.exists() ? (s.data() as Answer) : null),
      () => {
        // Usually "not yet": your own answer shows on this phone a moment before the
        // server has it, and the rules only open your partner's once it does. Try again.
        setA(null);
        if (attempt < 20) retry = setTimeout(() => setAttempt((n) => n + 1), 1500);
      },
    );
    return () => {
      stop();
      if (retry) clearTimeout(retry);
    };
  }, [cid, date, uid, enabled, attempt]);
  return enabled ? a : undefined;
}

export async function saveAnswer(cid: string, date: string, uid: string, qid: number, text: string) {
  const clean = text.trim().slice(0, ANSWER_MAX);
  if (!clean) return;
  await setDoc(answerRef(cid, date, uid), { text: clean, qid, at: serverTimestamp() });
}

export async function removeAnswer(cid: string, date: string, uid: string) {
  await deleteDoc(answerRef(cid, date, uid));
}

/** Recent days, newest first (to show the ones you both answered). */
export function useRecentQuestionDays(cid: string | null, max = 30): QuestionDay[] {
  const [days, setDays] = useState<QuestionDay[]>([]);
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      query(collection(db, 'couples', cid, 'questions'), orderBy('date', 'desc'), limit(max)),
      (s) => setDays(s.docs.map((d) => toDay(d.data()))),
      () => setDays([]),
    );
  }, [cid, max]);
  return days;
}
