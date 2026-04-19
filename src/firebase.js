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
let messaging;

function getFirebaseApp() {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

function getFirebaseMessaging() {
  if (!messaging) messaging = getMessaging(getFirebaseApp());
  return messaging;
}

// Request permission and register FCM token with the backend.
// Returns the token string, or null if permission denied / not supported.
export async function setupPushNotifications() {
  try {
    if (!('Notification' in window)) return null;           // not supported
    if (!('serviceWorker' in navigator)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('Push permission denied — in-app notifications only');
      return null;
    }

    const token = await getToken(getFirebaseMessaging(), { vapidKey: VAPID_KEY });
    if (!token) return null;

    // Store token in backend (best-effort, non-blocking)
    authFetch('/api/notifications/fcm-token', {
      method: 'POST',
      body: { token },
    }).catch(() => {});

    return token;
  } catch (err) {
    console.warn('FCM setup error:', err.message);
    return null;
  }
}

// Listen for foreground push messages (app is open).
// Returns the unsubscribe function.
export function onForegroundMessage(callback) {
  try {
    return onMessage(getFirebaseMessaging(), callback);
  } catch {
    return () => {};
  }
}
