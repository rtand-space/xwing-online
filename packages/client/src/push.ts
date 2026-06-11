const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787';

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Ask for notification permission and register a push subscription for this seat. */
export async function subscribePush(code: string, guestId: string): Promise<void> {
  if (!VAPID_PUBLIC || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ((await Notification.requestPermission()) !== 'granted') return;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    await fetch(`${SERVER}/games/${code}/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ guestId, subscription: subscription.toJSON() }),
    });
  } catch {
    /* notifications are optional */
  }
}
