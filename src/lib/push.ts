// src/lib/push.ts — Notifikasi Push (Web Push) untuk PWA
type SB = any;

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushStatus = (): 'granted' | 'denied' | 'default' | 'unsupported' => {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission as any;
};

/** Minta izin + daftarkan langganan push ke database */
export async function enablePush(supabase: SB, memberId: string) {
  if (!pushSupported()) throw new Error('Browser ini tidak mendukung notifikasi push.');
  if (!VAPID_PUBLIC) throw new Error('VAPID public key belum diset (NEXT_PUBLIC_VAPID_PUBLIC_KEY).');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }

  const j: any = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: memberId,
      endpoint: j.endpoint,
      p256dh: j.keys?.p256dh,
      auth: j.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 180),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw new Error(error.message);
  return true;
}

export async function disablePush(supabase: SB) {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const j: any = sub.toJSON();
  await supabase.from('push_subscriptions').delete().eq('endpoint', j.endpoint);
  await sub.unsubscribe();
}

/** Kirim notifikasi ke sejumlah anggota (lewat server) */
export async function pushNotify(
  supabase: SB,
  payload: { memberIds: string[]; title: string; body: string; url?: string; tag?: string }
) {
  try {
    if (!payload.memberIds?.length) return;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;

    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    /* notifikasi gagal tak boleh mengganggu alur utama */
  }
}

/** Hapus badge angka di ikon PWA */
export const clearBadge = () => {
  try { (navigator as any).clearAppBadge?.(); } catch { /* abaikan */ }
};
