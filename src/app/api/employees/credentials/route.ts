// src/app/api/employees/credentials/route.ts
// Reset email / password LOGIN karyawan (untuk kasus lupa) — HANYA admin @invisual.studio.
// Memakai service_role (mengubah akun orang lain), dengan verifikasi pemanggil.
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE || '';
const admin = () => createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

export async function POST(req: Request) {
  if (!serviceRole) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE belum diset di server.' }, { status: 500 });
  }
  try {
    // 1) Verifikasi pemanggil = admin @invisual.studio
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'Tidak berwenang.' }, { status: 401 });

    const asUser = createClient(url, anon, { auth: { persistSession: false } });
    const { data: u, error: ue } = await asUser.auth.getUser(token);
    if (ue || !u?.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    if (!String(u.user.email || '').toLowerCase().endsWith('@invisual.studio')) {
      return NextResponse.json({ error: 'Hanya admin yang dapat mengatur ulang kredensial karyawan.' }, { status: 403 });
    }

    // 2) Ambil target + kredensial baru
    const body = await req.json();
    const selfName = body?.selfName ? String(body.selfName).trim() : null;

    // ── MODE A: ubah nama admin sendiri (tanpa idKaryawan) ──
    if (selfName && !body?.idKaryawan) {
      if (selfName.length < 2) return NextResponse.json({ error: 'Nama minimal 2 karakter.' }, { status: 400 });
      const sb0 = admin();
      await sb0.auth.admin.updateUserById(u.user.id, { user_metadata: { ...(u.user.user_metadata || {}), name: selfName } }).catch(() => {});
      await sb0.from('members').update({ name: selfName }).eq('id', u.user.id);
      return NextResponse.json({ ok: true, nama: selfName, self: true });
    }

    // ── MODE B: reset kredensial / nama karyawan ──
    const idKaryawan = String(body?.idKaryawan || '');
    const newEmail = body?.newEmail ? String(body.newEmail).trim().toLowerCase() : null;
    const newPassword = body?.newPassword ? String(body.newPassword) : null;
    const newName = body?.newName ? String(body.newName).trim() : null;

    if (!idKaryawan) return NextResponse.json({ error: 'idKaryawan wajib.' }, { status: 400 });
    if (!newEmail && !newPassword && !newName) return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 });
    if (newName && newName.length < 2) return NextResponse.json({ error: 'Nama minimal 2 karakter.' }, { status: 400 });
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }
    if (newPassword && newPassword.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
    }

    const sb = admin();
    const { data: emp } = await sb.from('employees').select('user_id, email, nama').eq('idKaryawan', idKaryawan).single();
    if (!emp?.user_id) {
      return NextResponse.json({ error: 'Karyawan belum punya akun login (user_id kosong).' }, { status: 404 });
    }

    // 3) Update akun auth (email_confirm agar email baru langsung aktif tanpa verifikasi)
    const patch: any = {};
    if (newEmail) { patch.email = newEmail; patch.email_confirm = true; }
    if (newPassword) patch.password = newPassword;
    if (newName) patch.user_metadata = { ...(newName ? { name: newName } : {}) };

    if (Object.keys(patch).length) {
      const { error: ae } = await sb.auth.admin.updateUserById(emp.user_id, patch);
      if (ae) {
        const dup = /already been registered|already exists|duplicate/i.test(ae.message);
        return NextResponse.json({ error: dup ? 'Email tersebut sudah dipakai akun lain.' : ('Gagal memperbarui akun: ' + ae.message) }, { status: 400 });
      }
    }

    // 4) Sinkronkan ke tabel employees + members
    if (newEmail) {
      await sb.from('employees').update({ email: newEmail, emailLogin: newEmail }).eq('idKaryawan', idKaryawan);
      await sb.from('members').update({ email: newEmail }).eq('id', emp.user_id);
    }
    if (newName) {
      await sb.from('employees').update({ nama: newName }).eq('idKaryawan', idKaryawan);
      await sb.from('members').update({ name: newName }).eq('id', emp.user_id);
    }
    // Kalau password direset manual, tak perlu paksa ganti lagi
    if (newPassword) {
      await sb.auth.admin.updateUserById(emp.user_id, { user_metadata: { ...(u.user.user_metadata || {}), must_change_password: false } })
        .catch(() => {});
    }

    return NextResponse.json({ ok: true, nama: newName || emp.nama });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Kesalahan server' }, { status: 500 });
  }
}
