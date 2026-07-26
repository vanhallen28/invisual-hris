// src/lib/keuangan/tipe.ts
//
// Bentuk data modul Keuangan. Sengaja tidak ada satu pun tipe yang
// merujuk karyawan, absensi, atau payroll.

export type Jenis = 'in' | 'out';
export type SumberTransaksi = 'manual' | 'import';

export type Kategori = {
  id: string;
  name: string;
  kind: Jenis;
  is_system: boolean;
  sort_order: number;
};

export type Akun = {
  id: string;
  name: string;
  kind: 'cash' | 'bank' | 'ewallet' | 'receivable';
  is_active: boolean;
};

export type Transaksi = {
  id: string;
  occurred_on: string;
  kind: Jenis;
  category_id: string;
  account_id: string;
  amount: number;
  note: string;
  source: SumberTransaksi;
};

/** Transaksi lengkap dengan nama kategori & akun hasil join. */
export type BarisTransaksi = Transaksi & {
  category_name: string;
  account_name: string;
};

export type TotalPeriode = { masuk: number; keluar: number; bersih: number };

export type Anggaran = { category_id: string; amount_monthly: number };

export type TotalKategori = { kategoriId: string; nama: string; total: number };

export type TitikTren = { periode: string; masuk: number; keluar: number };

export type StatusAnggaran = {
  kategoriId: string;
  nama: string;
  anggaran: number;
  terpakai: number;
  persen: number;
  tingkat: 'ok' | 'warn' | 'over';
};
