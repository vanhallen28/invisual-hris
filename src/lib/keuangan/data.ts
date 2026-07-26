// src/lib/keuangan/data.ts
//
// Pengganti `lib/queries.ts` + `actions.ts` milik modul asli. Modul itu
// memakai Server Action dan klien Supabase sisi-server (cookie). Di HRIS
// semuanya berjalan di browser dengan klien yang sama seperti Corporate
// Vault, dan yang menjaga data adalah RLS di database.
//
// Semua fungsi melempar Error berpesan manusiawi lewat `jelaskanGalat`,
// supaya kegagalan tidak pernah hilang tanpa jejak.

import { fin, jelaskanGalat } from '@/lib/keuangan/klien';
import { supabase } from '@/lib/supabase';
import { budgetLevel, periodRange, shiftPeriod } from '@/lib/keuangan/format';
import type {
  Akun, Anggaran, BarisTransaksi, Jenis, Kategori,
  StatusAnggaran, TitikTren, TotalKategori, TotalPeriode,
} from '@/lib/keuangan/tipe';

const PILIH_TX =
  'id, occurred_on, kind, category_id, account_id, amount, note, source, categories(name), accounts(name)';

const angka = (v: unknown) =>
  typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0;

// Supabase memulangkan relasi sebagai objek ATAU larik satu elemen,
// tergantung bentuk relasinya. Ditangani dua-duanya supaya nama kategori
// tidak diam-diam jadi "—".
function namaRelasi(r: unknown): string {
  if (!r) return '—';
  if (Array.isArray(r)) return String((r[0] as { name?: string })?.name ?? '—');
  return String((r as { name?: string }).name ?? '—');
}

function petakan(r: Record<string, unknown>): BarisTransaksi {
  return {
    id: String(r.id),
    occurred_on: String(r.occurred_on),
    kind: r.kind === 'out' ? 'out' : 'in',
    category_id: String(r.category_id),
    account_id: String(r.account_id),
    amount: angka(r.amount),
    note: String(r.note ?? ''),
    source: r.source === 'import' ? 'import' : 'manual',
    category_name: namaRelasi(r.categories),
    account_name: namaRelasi(r.accounts),
  };
}

/* ════════════════════ MASTER ════════════════════ */

export async function ambilKategori(): Promise<Kategori[]> {
  const { data, error } = await fin()
    .from('categories')
    .select('id, name, kind, is_system, sort_order')
    .order('kind')
    .order('sort_order');
  if (error) throw new Error(jelaskanGalat(error.message));
  return (data ?? []) as Kategori[];
}

export async function ambilAkun(): Promise<Akun[]> {
  const { data, error } = await fin()
    .from('accounts')
    .select('id, name, kind, is_active')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new Error(jelaskanGalat(error.message));
  return (data ?? []) as Akun[];
}

/* ════════════════════ TRANSAKSI ════════════════════ */

export type SaringanTransaksi = {
  /** "2026-07". Kosongkan untuk semua bulan. */
  periode?: string;
  jenis?: Jenis;
  kategoriId?: string;
  cari?: string;
};

export async function cariTransaksi(
  s: SaringanTransaksi,
  batas = 300,
): Promise<BarisTransaksi[]> {
  let q = fin().from('transactions').select(PILIH_TX);

  if (s.periode) {
    const [dari, sampai] = periodRange(s.periode);
    q = q.gte('occurred_on', dari).lte('occurred_on', sampai);
  }
  if (s.jenis) q = q.eq('kind', s.jenis);
  if (s.kategoriId) q = q.eq('category_id', s.kategoriId);
  if (s.cari) q = q.ilike('note', `%${s.cari}%`);

  const { data, error } = await q
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(batas);

  if (error) throw new Error(jelaskanGalat(error.message));
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(petakan);
}

export type IsianTransaksi = {
  occurred_on: string;
  kind: Jenis;
  category_id: string;
  account_id: string;
  amount: number;
  note: string;
};

/** Memeriksa isian sebelum menyentuh database. Null = lolos. */
export function periksaIsian(f: IsianTransaksi): string | null {
  if (!f.occurred_on) return 'Tanggal wajib diisi.';
  if (f.kind !== 'in' && f.kind !== 'out') return 'Jenis transaksi tidak sah.';
  if (!f.category_id) return 'Kategori wajib dipilih.';
  if (!f.account_id) return 'Akun wajib dipilih.';
  if (!(f.amount > 0)) return 'Jumlah harus lebih besar dari nol.';
  return null;
}

export async function simpanTransaksi(f: IsianTransaksi): Promise<void> {
  const salah = periksaIsian(f);
  if (salah) throw new Error(salah);

  const { data: { session } } = await supabase.auth.getSession();

  const { error } = await fin()
    .from('transactions')
    .insert({ ...f, note: f.note.trim(), source: 'manual', created_by: session?.user?.id ?? null });

  if (error) throw new Error(jelaskanGalat(error.message));
}

export async function hapusTransaksi(id: string): Promise<void> {
  const { error } = await fin().from('transactions').delete().eq('id', id);
  if (error) throw new Error(jelaskanGalat(error.message));
}

/** Semua transaksi dalam satu bulan. Dipakai Ringkasan. */
export async function transaksiBulan(periode: string): Promise<BarisTransaksi[]> {
  return cariTransaksi({ periode }, 1000);
}

/** Beberapa transaksi terbaru, lintas bulan. */
export async function transaksiTerakhir(batas = 8): Promise<BarisTransaksi[]> {
  const { data, error } = await fin()
    .from('transactions')
    .select(PILIH_TX)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(batas);
  if (error) throw new Error(jelaskanGalat(error.message));
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(petakan);
}

/* ════════════════════ KATEGORI ════════════════════ */

export async function tambahKategori(nama: string, jenis: Jenis): Promise<void> {
  const bersih = nama.trim();
  if (!bersih) throw new Error('Nama kategori masih kosong.');
  if (jenis !== 'in' && jenis !== 'out') throw new Error('Jenis kategori tidak sah.');

  const { error } = await fin()
    .from('categories')
    .insert({ name: bersih, kind: jenis, sort_order: 99 });

  if (error) {
    // 23505 = pelanggaran unique (kind, name)
    if (error.code === '23505') throw new Error(`Kategori "${bersih}" sudah ada.`);
    throw new Error(jelaskanGalat(error.message));
  }
}

export async function hapusKategori(id: string): Promise<void> {
  const { error } = await fin().from('categories').delete().eq('id', id);
  if (error) {
    // 23503 = masih dirujuk baris transaksi
    if (error.code === '23503') {
      throw new Error('Kategori ini masih dipakai transaksi, jadi tidak bisa dihapus.');
    }
    throw new Error(jelaskanGalat(error.message));
  }
}

/* ════════════════════ ANGGARAN ════════════════════ */

export async function ambilAnggaran(): Promise<Anggaran[]> {
  const { data, error } = await fin().from('budgets').select('category_id, amount_monthly');
  if (error) throw new Error(jelaskanGalat(error.message));
  return (data ?? []).map((b: Record<string, unknown>) => ({
    category_id: String(b.category_id),
    amount_monthly: angka(b.amount_monthly),
  }));
}

/**
 * Menyimpan seluruh anggaran sekaligus.
 * Nilai 0 / kosong berarti "tanpa anggaran" → barisnya DIHAPUS, bukan
 * disimpan sebagai nol. Kalau disimpan nol, kategori itu akan selamanya
 * terhitung "lewat anggaran" begitu ada satu pengeluaran.
 */
export async function simpanAnggaran(peta: Record<string, number>): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  const oleh = session?.user?.id ?? null;

  const isi: { category_id: string; amount_monthly: number; updated_by: string | null }[] = [];
  const kosong: string[] = [];

  for (const [id, nilai] of Object.entries(peta)) {
    if (nilai > 0) isi.push({ category_id: id, amount_monthly: nilai, updated_by: oleh });
    else kosong.push(id);
  }

  if (isi.length) {
    const { error } = await fin().from('budgets').upsert(isi, { onConflict: 'category_id' });
    if (error) throw new Error(jelaskanGalat(error.message));
  }
  if (kosong.length) {
    const { error } = await fin().from('budgets').delete().in('category_id', kosong);
    if (error) throw new Error(jelaskanGalat(error.message));
  }

  return isi.length;
}

/* ════════════════════ AGREGAT ════════════════════ */

/** Total masuk & keluar beberapa bulan terakhir, untuk grafik tren. */
export async function ambilTren(periode: string, bulan = 6): Promise<TitikTren[]> {
  const pertama = shiftPeriod(periode, -(bulan - 1));
  const [dari] = periodRange(pertama);
  const [, sampai] = periodRange(periode);

  const { data, error } = await fin()
    .from('transactions')
    .select('occurred_on, kind, amount')
    .gte('occurred_on', dari)
    .lte('occurred_on', sampai);
  if (error) throw new Error(jelaskanGalat(error.message));

  const ember = new Map<string, { masuk: number; keluar: number }>();
  for (let i = bulan - 1; i >= 0; i--) {
    ember.set(shiftPeriod(periode, -i), { masuk: 0, keluar: 0 });
  }
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const kunci = String(r.occurred_on).slice(0, 7);
    const e = ember.get(kunci);
    if (!e) continue;
    if (r.kind === 'in') e.masuk += angka(r.amount);
    else e.keluar += angka(r.amount);
  }
  return [...ember.entries()].map(([p, v]) => ({ periode: p, ...v }));
}

/**
 * Saldo seluruh transaksi sampai akhir periode. Dijumlahkan di DATABASE
 * lewat fungsi `finance.cumulative_balance`, bukan menarik ribuan baris
 * ke browser.
 */
export async function saldoKumulatif(periode: string): Promise<number> {
  const [, sampai] = periodRange(periode);
  const { data, error } = await fin().rpc('cumulative_balance', { p_until: sampai });
  if (error) throw new Error(jelaskanGalat(error.message));
  return angka(data);
}

/* ════════════════════ HITUNGAN (murni) ════════════════════ */

export function totalDari(baris: BarisTransaksi[]): TotalPeriode {
  let masuk = 0;
  let keluar = 0;
  for (const b of baris) {
    if (b.kind === 'in') masuk += b.amount;
    else keluar += b.amount;
  }
  return { masuk, keluar, bersih: masuk - keluar };
}

/** Total per kategori, terurut dari terbesar. */
export function totalKategori(baris: BarisTransaksi[], jenis: Jenis): TotalKategori[] {
  const peta = new Map<string, TotalKategori>();
  for (const b of baris) {
    if (b.kind !== jenis) continue;
    const ada = peta.get(b.category_id);
    if (ada) ada.total += b.amount;
    else peta.set(b.category_id, { kategoriId: b.category_id, nama: b.category_name, total: b.amount });
  }
  return [...peta.values()].sort((a, b) => b.total - a.total);
}

/** Realisasi belanja dibandingkan anggaran tiap kategori. */
export function statusAnggaran(
  baris: BarisTransaksi[],
  anggaran: Anggaran[],
  kategori: Kategori[],
): StatusAnggaran[] {
  const terpakai = new Map<string, number>();
  for (const b of baris) {
    if (b.kind !== 'out') continue;
    terpakai.set(b.category_id, (terpakai.get(b.category_id) ?? 0) + b.amount);
  }
  const nama = new Map(kategori.map((k) => [k.id, k.name]));

  return anggaran
    .filter((a) => a.amount_monthly > 0)
    .map((a) => {
      const pakai = terpakai.get(a.category_id) ?? 0;
      const persen = (pakai / a.amount_monthly) * 100;
      return {
        kategoriId: a.category_id,
        nama: nama.get(a.category_id) ?? '—',
        anggaran: a.amount_monthly,
        terpakai: pakai,
        persen,
        tingkat: budgetLevel(persen),
      };
    })
    .sort((a, b) => b.persen - a.persen);
}
