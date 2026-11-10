/**
 * Delete my account (required by the App Store and Google Play).
 *
 * 1. Confirm it's really you (your password), before anything is touched.
 * 2. The deleteAccount server function does the rest, in order: unlinks,
 *    deletes the shared space (a reconnect is no longer possible), your private
 *    logs, settings, vault and files, your invites, and last your sign-in.
 */
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from './firebase';

export type DeleteAccountResult = 'deleted' | 'wrong-password' | 'failed';

export async function deleteMyAccount(opts: { uid: string; cid: string | null; password: string }): Promise<DeleteAccountResult> {
  const user = auth.currentUser;
  if (!user || user.uid !== opts.uid) return 'failed';
  try {
    if (user.email) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, opts.password));
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    return code.includes('wrong-password') || code.includes('invalid-credential') || code.includes('invalid-login') ? 'wrong-password' : 'failed';
  }
  try {
    await httpsCallable(functions, 'deleteAccount')({});
    await signOut(auth).catch(() => {});
    return 'deleted';
  } catch {
    return 'failed';
  }
}
