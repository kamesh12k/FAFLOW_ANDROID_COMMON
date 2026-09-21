import { useEffect, useRef } from 'react';
import { subscribeToPush, isPushSupported, getNotificationPermission } from '../utils/pushNotifications';

const STORAGE_KEY = 'faflow_notif_permission';

/**
 * Manages notification permission lifecycle.
 *
 * Rules:
 *  - On every page open we read the REAL browser permission.
 *  - If browser says "granted"  → cache it, no prompt.
 *  - If browser says "denied"   → cache it, no prompt (browser blocks it anyway).
 *  - If browser says "default"  → permission was never granted OR was revoked by the user.
 *      * If our cache shows "granted" it means it was revoked → we re-ask.
 *      * If our cache shows "default" or nothing → ask once per session.
 *  - We NEVER ask more than once per browser session (sessionStorage flag guards this).
 */
export function useNotificationPermission() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!isPushSupported()) return;

    async function handlePermission() {
      const browserPerm = getNotificationPermission(); // 'granted' | 'denied' | 'default'
      const cached = localStorage.getItem(STORAGE_KEY);

      // Always sync cache to reflect current reality
      if (browserPerm === 'granted') {
        localStorage.setItem(STORAGE_KEY, 'granted');
        return; // already granted — nothing to do
      }

      if (browserPerm === 'denied') {
        localStorage.setItem(STORAGE_KEY, 'denied');
        return; // browser blocked — cannot ask
      }

      // browserPerm === 'default' from here
      // Detect revocation: user previously granted but browser is back to default
      const wasGranted = cached === 'granted';

      // Guard: only ask once per browser session
      const sessionKey = 'faflow_notif_asked_this_session';
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');

      // Small delay so the page renders before the prompt appears
      await new Promise((res) => setTimeout(res, 1500));

      try {
        if (wasGranted) {
          console.info('[FAFLOW] Notification permission was revoked. Re-requesting...');
        }
        await subscribeToPush();
        localStorage.setItem(STORAGE_KEY, 'granted');
      } catch (err) {
        const currentPerm = getNotificationPermission();
        localStorage.setItem(STORAGE_KEY, currentPerm);
        if (currentPerm !== 'denied') {
          console.info('[FAFLOW] Notification permission not granted:', err.message);
        }
      }
    }

    handlePermission();
  }, []);
}
