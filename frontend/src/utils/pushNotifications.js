import { notificationsApi } from '../api/services';

/**
 * Converts a URL-safe Base64 string to a Uint8Array for VAPID applicationServerKey.
 */
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether Web Push Notifications and Service Workers are supported in the current browser.
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Returns current browser notification permission ('default', 'granted', 'denied').
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Registers the Service Worker (/sw.js).
 */
export async function registerServiceWorker() {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Retrieves the current push subscription if active.
 */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (error) {
    console.error('Error fetching push subscription:', error);
    return null;
  }
}

/**
 * Requests browser permission and subscribes the user to Web Push.
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error('Web Push is not supported on this browser.');
  }

  // 1. Request user permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked in your browser settings. Please enable them in site permissions.'
        : 'Notification permission was dismissed.'
    );
  }

  // 2. Fetch VAPID public key from backend
  const { data } = await notificationsApi.vapidPublicKey();
  if (!data?.key) {
    throw new Error('VAPID public key is not configured on the server.');
  }

  const applicationServerKey = urlB64ToUint8Array(data.key);

  // 3. Register service worker and subscribe to PushManager
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  // 4. Save subscription to backend database
  await notificationsApi.subscribe(subscription.toJSON());

  return subscription;
}

/**
 * Unsubscribes from Web Push.
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Notify backend
      try {
        await notificationsApi.unsubscribe({ endpoint: subscription.endpoint });
      } catch (e) {
        console.warn('Could not notify backend of push unsubscribe:', e);
      }
      // Unsubscribe locally
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    throw error;
  }
}
