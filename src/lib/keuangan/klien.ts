// src/lib/keuangan/klien.ts
//
// Satu-satunya pintu modul Keuangan ke database.
//
// Modul aslinya memakai @supabase/ssr (sesi di cookie) + Server Action.
// HRIS memakai supabase-js dengan sesi di localStorage ('invisual-auth')
// dan penjaga per-halaman. Kalau keduanya dicampur, karyawan yang sudah
// login di HRIS akan dianggap BELUM login di Keuangan. Karena itu modul
// ini memakai klien HRIS yang sama — persis pola Corporate Vault.
//
// Keamanan TIDAK berkurang: yang menjaga data adalah Row Level Security
// di database (lihat keuangan-01-skema.sql), bukan kode di browser.

import { supabase } from '@/lib/supabase';

export type PeranKeuangan = 'admin' | 'finance' | 'viewer';

/**
 * Semua tabel modul ini hidup di schema `finance`, bukan `public`.
 * Schema tersebut WAJIB terdaftar di Supabase Dashboard →
 * Project Settings → API → Exposed schemas.
 */
export const fin = () => supabase.schema('finance');

/** Pesan galat yang bisa dibaca manusia, bukan kode teknis Supabase. */
export function jelaskanGalat(pesan: string): string {
  const p = String(pesan || '');
  if (/schema must be one of|schema .*not.*expos|does not exist/i.test(p)) {
    return (
      'Schema "finance" belum terdaftar di Supabase. Buka Project Settings → ' +
      'API → Exposed schemas, tambahkan "finance", lalu muat ulang halaman ini.'
    );
  }
  if (/JWT|not authenticated|session/i.test(p)) {
    return 'Sesi berakhir. Silakan masuk lagi.';
  }
  return p;
}

/**
 * Peran keuangan pengguna yang sedang login, atau null kalau tidak punya.
 *
 * Memakai getSession() (baca localStorage), BUKAN getUser() yang selalu
 * menghubungi server — pelajaran dari bug "sesi Daily Task hilang":
 * jaringan tersendat sesaat tidak boleh terbaca sebagai "belum login".
 */
export async function ambilPeran(): Promise<PeranKeuangan | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return null;

  const { data, error } = await fin()
    .from('app_roles')
    .select('role')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) throw new Error(jelaskanGalat(error.message));

  const r = data?.role;
  return r === 'admin' || r === 'finance' || r === 'viewer' ? r : null;
}

export const bolehTulis = (p: PeranKeuangan | null) => p === 'admin' || p === 'finance';
export const bolehAturAkses = (p: PeranKeuangan | null) => p === 'admin';
