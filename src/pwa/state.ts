import { create } from 'zustand';

/** Chrome's install prompt event, which TypeScript's DOM types do not name. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** Held from `beforeinstallprompt` so «نصب» can show it later, on a tap. */
  installPrompt: InstallPromptEvent | null;
  /** Running as an installed app rather than in a browser tab. */
  standalone: boolean;
  /** A new version took over this page; a reload shows it. */
  updateReady: boolean;
  online: boolean;
}

export const usePwa = create<PwaState>(() => ({
  installPrompt: null,
  standalone: false,
  updateReady: false,
  online: true,
}));

export type Platform = 'ios' | 'android' | 'other';

/** iPadOS reports itself as a Mac, so a touch screen gives it away. */
export function detectPlatform(): Platform {
  const agent = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(agent)) return 'ios';
  if (/macintosh/i.test(agent) && navigator.maxTouchPoints > 1) return 'ios';
  if (/android/i.test(agent)) return 'android';
  return 'other';
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Safari's own flag for a page opened from the home screen.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function install(): Promise<boolean> {
  const event = usePwa.getState().installPrompt;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // The event can be used once; Chrome sends a fresh one if it may ask again.
  usePwa.setState({ installPrompt: null });
  return outcome === 'accepted';
}

/**
 * Wires the page to the browser's PWA events. Called once from `Providers`;
 * returns the cleanup.
 */
export function watchPwa(): () => void {
  const set = usePwa.setState;
  set({ standalone: isStandalone(), online: navigator.onLine });

  const onPrompt = (event: Event) => {
    // Keep Chrome's mini-infobar from appearing uninvited; the settings page
    // offers the install instead.
    event.preventDefault();
    set({ installPrompt: event as InstallPromptEvent });
  };
  const onInstalled = () => set({ installPrompt: null, standalone: true });
  const onOnline = () => set({ online: true });
  const onOffline = () => set({ online: false });
  const display = window.matchMedia('(display-mode: standalone)');
  const onDisplay = () => set({ standalone: isStandalone() });

  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  display.addEventListener('change', onDisplay);

  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    display.removeEventListener('change', onDisplay);
  };
}

/**
 * Registers the service worker and reports when a new version has taken over.
 * The worker activates itself on install, so a page that was already
 * controlled sees `controllerchange` once the new one is in charge — from then
 * on navigations are the new version's, and a reload brings this page along.
 */
export function registerServiceWorker(): () => void {
  if (!('serviceWorker' in navigator)) return () => {};

  const hadController = Boolean(navigator.serviceWorker.controller);
  const onChange = () => {
    if (hadController) usePwa.setState({ updateReady: true });
  };
  navigator.serviceWorker.addEventListener('controllerchange', onChange);

  let registration: ServiceWorkerRegistration | null = null;
  navigator.serviceWorker
    .register('/sw.js')
    .then((result) => {
      registration = result;
    })
    .catch(() => {
      // An install that fails costs the offline shell and nothing else. It
      // always fails on plain HTTP, and on HTTPS with a certificate the browser
      // does not trust.
    });

  // An installed app can stay open for days; look for a new version whenever
  // it comes back to the front.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void registration?.update().catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
