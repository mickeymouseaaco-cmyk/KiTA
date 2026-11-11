/** Status: the live list for me and my partner, from the love notes. */
import { useMemo } from 'react';

import { useMessages } from './messages';
import { activeStatuses, unreadNotes, unseenCount } from './status-pure';

export * from './status-pure';

/** My and my partner's statuses from the last day, plus counts for the badges. */
export function useStatuses(cid: string | null | undefined, uid: string | null | undefined, partnerId: string | null | undefined) {
  const { messages } = useMessages(cid ?? null, 150);
  return useMemo(() => {
    const mine = uid ? activeStatuses(messages, uid) : [];
    const theirs = partnerId ? activeStatuses(messages, partnerId) : [];
    return { mine, theirs, unseen: unseenCount(theirs), unreadNotes: uid ? unreadNotes(messages, uid) : 0 };
  }, [messages, uid, partnerId]);
}
