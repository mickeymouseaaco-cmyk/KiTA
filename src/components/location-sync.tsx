/** While KiTA is open, keeps my shared location fresh (only if I chose to share). */
import { useLocationSharing, useShareWhileOpen } from '@/lib/location';
import { useSession } from '@/lib/session';

export function LocationSync() {
  const { uid, cid } = useSession();
  const sharing = useLocationSharing(uid);
  useShareWhileOpen(uid, cid, sharing);
  return null;
}
