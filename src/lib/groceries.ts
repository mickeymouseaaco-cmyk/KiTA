/**
 * The shared grocery list. One doc per item at couples/{cid}/groceries/{id},
 * so both of you can add and tick at the same time (even in the shop, even
 * offline: changes sync when you're back).
 */
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch, type Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { aisleFor, splitQty, type Aisle, type GroceryItem } from './groceries-pure';
import { localFirst } from './offline';

export * from './groceries-pure';

const col = (cid: string) => collection(db, 'couples', cid, 'groceries');

export function useGroceries(cid: string | null) {
  const [state, setState] = useState<{ cid: string; items: GroceryItem[] } | null>(null);
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      col(cid),
      (s) =>
        setState({
          cid,
          items: s.docs.map((d) => {
            const v = d.data({ serverTimestamps: 'estimate' });
            return {
              id: d.id,
              name: v.name,
              qty: v.qty || undefined,
              aisle: (v.aisle as Aisle) ?? 'other',
              done: !!v.done,
              doneBy: v.doneBy,
              addedBy: v.addedBy,
              createdMs: (v.createdAt as Timestamp | undefined)?.toMillis?.(),
            } satisfies GroceryItem;
          }),
        }),
      () => setState({ cid, items: [] }),
    );
  }, [cid]);
  const mine = state?.cid === cid ? state : null;
  return { items: mine?.items ?? [], ready: !!mine };
}

/** Add what was typed ("2kg beras" → beras, 2kg, pantry). */
export async function addGrocery(cid: string, uid: string, typed: string) {
  const { name, qty } = splitQty(typed);
  if (!name.trim()) return;
  const data: Record<string, unknown> = { name: name.trim().slice(0, 120), aisle: aisleFor(name), done: false, addedBy: uid, createdAt: serverTimestamp() };
  if (qty) data.qty = qty.slice(0, 40);
  await localFirst(setDoc(doc(col(cid)), data));
}

export async function toggleGrocery(cid: string, uid: string, item: GroceryItem) {
  await localFirst(
    updateDoc(doc(col(cid), item.id), item.done ? { done: false } : { done: true, doneBy: uid, doneAt: serverTimestamp() }),
  );
}

export async function removeGrocery(cid: string, id: string) {
  await localFirst(deleteDoc(doc(col(cid), id)));
}

/** Clear everything already in the trolley. */
export async function clearTicked(cid: string, items: GroceryItem[]) {
  const done = items.filter((i) => i.done);
  if (!done.length) return;
  const b = writeBatch(db);
  for (const i of done) b.delete(doc(col(cid), i.id));
  await localFirst(b.commit());
}
