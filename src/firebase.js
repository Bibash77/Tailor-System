import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { authFetch } from './context/AuthContext';

const firebaseConfig = {
  apiKey:            'AIzaSyDbAt8Shp7mJCNR_vhPEdly1e6wzmtRu2E',
  authDomain:        'tailor-app-9d570.firebaseapp.com',
  projectId:         'tailor-app-9d570',
  storageBucket:     'tailor-app-9d570.firebasestorage.app',
  messagingSenderId: '302737109397',
  appId:             '1:302737109397:web:0c26c615dd43aec10d469c',
  measurementId:     'G-S50G10F83Q',
};

const VAPID_KEY =
  'BLnCuvZk-jWHuxucvYkwhQYN0_61unY7UViHkMZYlk0Z-LcaaQyoQvrtSmBxJA7kUAosFD25uhCnee0yIr4Iku4';

let app;
let messaging = undefined; // undefined = not yet checked, null = unsupported

function getFirebaseApp() {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

function getFirebaseMessaging() {
  if (messaging !== undefined) return messaging;
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      messaging = null;
      return null;
    }
    messaging = getMessaging(getFirebaseApp());
  } catch {
    messaging = null;
  }
  return messaging;
}

export async function setupPushNotifications() {
  try {
    const m = getFirebaseMessaging();
    if (!m) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(m, { vapidKey: VAPID_KEY });
    if (!token) return null;

    authFetch('/api/notifications/fcm-token', {
      method: 'POST',
      body: { token },
    }).catch(() => {});

    return token;
  } catch (err) {
    console.warn('FCM setup:', err.message);
    return null;
  }
}

export function onForegroundMessage(callback) {
  try {
    const m = getFirebaseMessaging();
    if (!m) return () => {};
    return onMessage(m, callback);
  } catch {
    return () => {};
  }
}
