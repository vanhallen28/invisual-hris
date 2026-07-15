// src/app/api/livekit/token/route.ts
// Membuat token akses LiveKit untuk pengguna yang login + berhak atas channel voice.
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE || '';
const LK_KEY = process.env.LIVEKIT_API_KEY || '';
const LK_SECRET = process.env.LIVEKIT_API_SECRET || '';

export async function POST(req: Request) {
  if (!LK_KEY || !LK_SECRET) {
    return NextResponse.json({ error: 'LiveKit belum dikonfigurasi (LIVEKIT_API_KEY / LIVEKIT_API_SECRET).' }, { status: 500 });
  }

  try {
    // 1) Verifikasi sesi login
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'Tidak berwenang.' }, { status: 401 });

    const asUser = createClient(url, anon, { auth: { persistSession: false } });
    const { data: u, error: ue } = await asUser.auth.getUser(token);
    if (ue || !u?.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    const userId = u.user.id;

    const body = await req.json();
    const channelId = String(body?.channelId || '');
    if (!channelId) return NextResponse.json({ error: 'channelId wajib.' }, { status: 400 });

    // 2) Pastikan channel voice + user berhak (publik, atau anggota channel privat, atau manajer)
    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data: ch } = await admin.from('chat_channels').select('*').eq('id', channelId).single();
    if (!ch) return NextResponse.json({ error: 'Channel tidak ditemukan.' }, { status: 404 });
    if (!ch.is_voice) return NextResponse.json({ error: 'Channel ini bukan channel suara.' }, { status: 400 });

    const { data: meRow } = await admin.from('members').select('name, role').eq('id', userId).single();
    const isManager = meRow?.role === 'manager';

    if (ch.is_private && !isManager) {
      const { data: mem } = await admin.from('chat_channel_members')
        .select('member_id').eq('channel_id', channelId).eq('member_id', userId).maybeSingle();
      if (!mem) return NextResponse.json({ error: 'Anda bukan anggota channel ini.' }, { status: 403 });
    }

    // 3) Terbitkan token
    const at = new AccessToken(LK_KEY, LK_SECRET, {
      identity: userId,
      name: meRow?.name || 'Anggota',
      ttl: '2h',
    });
    at.addGrant({
      room: `channel-${channelId}`,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await at.toJwt();
    return NextResponse.json({ token: jwt, url: process.env.NEXT_PUBLIC_LIVEKIT_URL || '' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal membuat token' }, { status: 500 });
  }
}
