import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from './firebase';

let configured = false;

export function configureNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('hugs', {
      name: 'Hugs',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 140, 260, 220, 400],
    }).catch(() => {});
    Notifications.setNotificationChannelAsync('love-notes', {
      name: 'Love notes',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
    }).catch(() => {});
  }
}

export async function notificationStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Ask the OS for permission (only after our own gentle primer), then store the
 * Expo push token on my profile so the Cloud Function can reach this phone.
 */
export async function registerForPush(uid: string): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return false; // set extra.eas.projectId in app.json after `eas init`
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await updateDoc(doc(db, 'users', uid), { pushTokens: arrayUnion(token) });
  return true;
}

export async function setNotificationsPaused(uid: string, paused: boolean) {
  await updateDoc(doc(db, 'users', uid), { notificationsPaused: paused });
}
