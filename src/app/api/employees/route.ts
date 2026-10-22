// src/app/api/employees/route.ts
// Provisioning karyawan lewat server (service_role). Membuat/menghapus akun login +
// baris members (role Tracker), selaras dengan employees. TIDAK memakai anon key.
// Butuh env server-side: SUPABASE_SERVICE_ROLE (JANGAN diawali NEXT_PUBLIC_).
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE || '';
const admin = () => createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

/**
 * KEAMANAN (audit 22 Okt 2026): rute ini memakai service_role (melewati RLS) untuk membuat /
 * mengubah / menghapus akun karyawan — WAJIB hanya untuk admin HR yang login. Dulu tanpa
 * pemeriksaan sama sekali (siapa pun di internet bisa membuat akun HR / menghapus akun).
 * Pemanggil mengirim `Authorization: Bearer <access_token>` (lib/authHeader.ts).
 */
async function wajibHR(req: Request): Promise<NextResponse | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Tidak berwenang.' }, { status: 401 });
  try {
    const { data: u, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
    if (error || !u?.user) return NextResponse.json({ error: 'Sesi tidak valid. Silakan masuk ulang.' }, { status: 401 });
    if (!String(u.user.email || '').toLowerCase().endsWith('@invisual.studio')) {
      return NextResponse.json({ error: 'Hanya admin HR yang dapat mengelola data karyawan.' }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
  }
}
/** Kolom yang TIDAK boleh diubah lewat PATCH: penghubung akun login & kunci baris. */
const KOLOM_TERLARANG = new Set(['id', 'user_id', 'emailLogin', 'created_at']);
const bersihkanUbahan = (u: Record<string, any>) => Object.fromEntries(Object.entries(u || {}).filter(([k]) => !KOLOM_TERLARANG.has(k)));
/** Galat basis data tidak diteruskan mentah ke peramban (nama tabel/kolom); detail ke log server. */
const galat = (pesan: string, e: any, status = 400) => { console.error('[api/employees]', pesan, e?.message || e); return NextResponse.json({ error: pesan }, { status }); };

const LABEL_COLORS = ['bg-[#e2445c]','bg-[#579bfc]','bg-[#fdab3d]','bg-[#00c875]','bg-[#a25ddc]','bg-[#ff5ac4]','bg-[#9d99ff]','bg-emerald-500','bg-rose-400'];
const initials = (name: string) => {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0] || '?').slice(0, 2).toUpperCase();
};
const normRole = (r: any) => (String(r).toLowerCase() === 'manager' ? 'manager' : 'member');
const noKey = () => NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE belum diset di server (.env.local).' }, { status: 500 });

// Terapkan hak akses lanjutan: Content Hub + pembatasan board (board_access).
// boardAccess = daftar pola board (kosong/undefined = akses semua). Selalu di-lowercase.
async function applyAccess(sb: any, userId: string, contentHub: any, boardAccess: any, corporateAccess: any, accBrief: any) {
  if (typeof contentHub === 'boolean') {
    await sb.from('members').update({ content_hub: contentHub }).eq('id', userId);
  }
  if (typeof corporateAccess === 'boolean') {
    await sb.from('members').update({ corporate_access: corporateAccess }).eq('id', userId);
  }
  if (typeof accBrief === 'boolean') {
    await sb.from('members').update({ acc_brief: accBrief }).eq('id', userId);
  }
  if (Array.isArray(boardAccess)) {
    await sb.from('board_access').delete().eq('member_id', userId);
    const rows = boardAccess
      .map((p: any) => String(p || '').trim().toLowerCase())
      .filter(Boolean)
      .map((p: string) => ({ member_id: userId, board_pattern: p }));
    if (rows.length) await sb.from('board_access').insert(rows);
  }
}

// Baca hak akses karyawan (untuk mengisi form edit): role, Content Hub, board_access
export async function GET(req: Request) {
  const tolak = await wajibHR(req); if (tolak) return tolak;   // pemanggil dulu, baru konfigurasi server
  if (!serviceRole) return noKey();
  try {
    const { searchParams } = new URL(req.url);
    const idKaryawan = String(searchParams.get('idKaryawan') || '');
    if (!idKaryawan) return NextResponse.json({ error: 'idKaryawan wajib.' }, { status: 400 });
    const sb = admin();
    const { data: emp } = await sb.from('employees').select('user_id').eq('idKaryawan', idKaryawan).single();
    if (!emp?.user_id) return NextResponse.json({ role: 'member', contentHub: true, corporateAccess: false, accBrief: false, boardAccess: [] });
    const { data: mem } = await sb.from('members').select('role, content_hub, corporate_access, acc_brief').eq('id', emp.user_id).single();
    const { data: ba } = await sb.from('board_access').select('board_pattern').eq('member_id', emp.user_id);
    return NextResponse.json({
      role: mem?.role || 'member',
      contentHub: mem?.content_hub !== false,
      corporateAccess: mem?.corporate_access === true,
      accBrief: mem?.acc_brief === true,
      boardAccess: (ba || []).map((r: any) => String(r.board_pattern || '').toLowerCase()).filter(Boolean),
    });
  } catch (e: any) {
    return galat('Kesalahan server.', e, 500);
  }
}

// Buat karyawan: akun auth + employees + members(role)
export async function POST(req: Request) {
  const tolak = await wajibHR(req); if (tolak) return tolak;   // pemanggil dulu, baru konfigurasi server
  if (!serviceRole) return noKey();
  try {
    const body = await req.json();
    const { role = 'member', boardAccess, contentHub, corporateAccess, accBrief, ...empMentah } = body || {};
    const emp: Record<string, any> = bersihkanUbahan(empMentah);
    const email = String(emp.email || '').trim().toLowerCase();
    const pass = String(emp.idKaryawan || '').trim();
    if (!email || pass.length < 6) return NextResponse.json({ error: 'Email wajib & ID Karyawan minimal 6 karakter (dipakai sebagai password awal).' }, { status: 400 });

    const sb = admin();
    const { data: cu, error: ce } = await sb.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { name: emp.nama } });
    if (ce || !cu?.user) return NextResponse.json({ error: 'Gagal membuat akun login: ' + (ce?.message || 'unknown') }, { status: 400 });
    const userId = cu.user.id;

    const empPayload = { ...emp, email, emailLogin: email, user_id: userId };
    const { error: ee } = await sb.from('employees').insert([empPayload]);
    if (ee) { await sb.auth.admin.deleteUser(userId).catch(() => {}); return NextResponse.json({ error: 'Gagal menyimpan karyawan: ' + ee.message }, { status: 400 }); }

    const { error: me } = await sb.from('members').upsert({
      id: userId, name: emp.nama || email, email, initials: initials(emp.nama || email),
      role: normRole(role), color: LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)],
    }, { onConflict: 'id' });
    if (me) return NextResponse.json({ error: 'Karyawan tersimpan, tapi gagal menetapkan role Tracker: ' + me.message }, { status: 400 });

    await applyAccess(sb, userId, contentHub, boardAccess, corporateAccess, accBrief);

    return NextResponse.json({ ok: true, user_id: userId });
  } catch (e: any) {
    return galat('Kesalahan server.', e, 500);
  }
}

// Update data karyawan + role Tracker
export async function PATCH(req: Request) {
  const tolak = await wajibHR(req); if (tolak) return tolak;   // pemanggil dulu, baru konfigurasi server
  if (!serviceRole) return noKey();
  try {
    const body = await req.json();
    const { idKaryawan, role, boardAccess, contentHub, corporateAccess, accBrief, ...ubahanMentah } = body || {};
    const updates = bersihkanUbahan(ubahanMentah);
    if (!idKaryawan) return NextResponse.json({ error: 'idKaryawan wajib.' }, { status: 400 });
    const sb = admin();

    if (updates && Object.keys(updates).length) {
      const { error: ee } = await sb.from('employees').update(updates).eq('idKaryawan', idKaryawan);
      if (ee) return galat('Gagal menyimpan data karyawan.', ee);
    }
    if (role || boardAccess !== undefined || contentHub !== undefined || corporateAccess !== undefined || accBrief !== undefined) {
      const { data: emp } = await sb.from('employees').select('user_id').eq('idKaryawan', idKaryawan).single();
      if (emp?.user_id) {
        if (role) {
          const { error: me } = await sb.from('members').update({ role: normRole(role) }).eq('id', emp.user_id);
          if (me) return galat('Gagal menetapkan role Tracker.', me);
        }
        await applyAccess(sb, emp.user_id, contentHub, boardAccess, corporateAccess, accBrief);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return galat('Kesalahan server.', e, 500);
  }
}

// Hapus karyawan: akun auth + members + employees
export async function DELETE(req: Request) {
  const tolak = await wajibHR(req); if (tolak) return tolak;   // pemanggil dulu, baru konfigurasi server
  if (!serviceRole) return noKey();
  try {
    const { idKaryawan } = (await req.json()) || {};
    if (!idKaryawan) return NextResponse.json({ error: 'idKaryawan wajib.' }, { status: 400 });
    const sb = admin();
    const { data: emp } = await sb.from('employees').select('user_id').eq('idKaryawan', idKaryawan).single();
    const userId = emp?.user_id;
    if (userId) {
      await sb.from('members').delete().eq('id', userId);
      await sb.auth.admin.deleteUser(userId).catch(() => {});
    }
    const { error: ee } = await sb.from('employees').delete().eq('idKaryawan', idKaryawan);
    if (ee) return galat('Gagal menghapus data karyawan.', ee);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return galat('Kesalahan server.', e, 500);
  }
}
