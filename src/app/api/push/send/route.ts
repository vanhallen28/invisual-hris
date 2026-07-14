// src/app/api/push/send/route.ts
// Mengirim Web Push ke anggota tertentu. Memakai service_role (server-only).
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE || '';
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@invisual.studio';

export async function POST(req: Request) {
  if (!serviceRole || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: 'Env push belum lengkap (SUPABASE_SERVICE_ROLE / VAPID).' }, { status: 500 });
  }

  try {
    // 1) Verifikasi pemanggil harus user yang login
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'Tidak berwenang.' }, { status: 401 });

    const asUser = createClient(url, anon, { auth: { persistSession: false } });
    const { data: u, error: ue } = await asUser.auth.getUser(token);
    if (ue || !u?.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    const senderId = u.user.id;

    // 2) Ambil target
    const body = await req.json();
    const memberIds: string[] = (body?.memberIds || []).filter((id: string) => id && id !== senderId);
    if (!memberIds.length) return NextResponse.json({ ok: true, sent: 0 });

    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('*')
      .in('member_id', memberIds);

    if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const payload = JSON.stringify({
      title: String(body?.title || 'Invisual HRIS').slice(0, 80),
      body: String(body?.body || '').slice(0, 160),
      url: String(body?.url || '/'),
      tag: String(body?.tag || 'invisual'),
    });

    let sent = 0;
    const dead: string[] = [];

    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          // 404/410 = langganan sudah mati → bersihkan
          if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.endpoint);
        }
      })
    );

    if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead);

    return NextResponse.json({ ok: true, sent, cleaned: dead.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengirim notifikasi' }, { status: 500 });
  }
}
