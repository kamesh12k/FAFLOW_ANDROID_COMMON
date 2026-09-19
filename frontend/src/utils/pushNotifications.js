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
 * Checks whether Web Notifications and Service Workers are supported in the current browser.
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
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
 * Registers the Service Worker (/sw.js) safely.
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.warn('Service Worker registration skipped or failed:', error);
    return null;
  }
}

/**
 * Retrieves the current push subscription if active.
 */
export async function getCurrentSubscription() {
  if (typeof window === 'undefined') return null;

  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) return subscription;
      }
    } catch (error) {
      console.warn('Error fetching push subscription:', error);
    }
  }

  // Fallback: check standard notification permission
  if ('Notification' in window && Notification.permission === 'granted') {
    return { endpoint: 'local-desktop-notifications' };
  }

  return null;
}

/**
 * Requests browser permission and subscribes the user to Web Push / Desktop alerts.
 */
export async function subscribeToPush() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Desktop notifications are not supported on this browser.');
  }

  // 1. Request user permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked in your browser settings. Please click the padlock / shield icon in your address bar to allow notifications.'
        : 'Notification permission was dismissed.'
    );
  }

  // 2. Fetch VAPID public key from backend if service worker & PushManager available
  let applicationServerKey = null;
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const { data } = await notificationsApi.vapidPublicKey();
      if (data?.key) {
        applicationServerKey = urlB64ToUint8Array(data.key);
      }
    } catch (e) {
      console.warn('Could not load VAPID key:', e);
    }

    try {
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      await navigator.serviceWorker.ready;

      if (applicationServerKey) {
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }
        if (subscription) {
          await notificationsApi.subscribe(subscription.toJSON());
          return { mode: 'web_push', subscription };
        }
      }
    } catch (pushErr) {
      console.warn('PushManager subscription bypassed (using HTML5 desktop alerts):', pushErr);
      // For browsers like Brave with Google Services push disabled or push service errors:
      // Gracefully activate HTML5 Desktop Alerts without throwing an error
      return { mode: 'desktop_alerts', message: 'Desktop notifications active' };
    }
  }

  return { mode: 'desktop_alerts', message: 'Desktop notifications active' };
}

/**
 * Unsubscribes from Web Push.
 */
export async function unsubscribeFromPush() {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          try {
            await notificationsApi.unsubscribe({ endpoint: subscription.endpoint });
          } catch (e) {
            console.warn('Could not notify backend of push unsubscribe:', e);
          }
          await subscription.unsubscribe();
        }
      }
    }
  } catch (error) {
    console.warn('Error unsubscribing from push:', error);
  }
}
