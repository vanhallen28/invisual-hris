// src/components/brutal/tipe.ts
// Bentuk baris data yang dibaca tata letak Neo-Brutal (hanya kolom yang ditampilkan).
// Halaman tetap memakai datanya sendiri; tipe ini sekadar menjaga komponen tampilan tetap rapi.

export type BarisAbsen = {
  id?: string | number;
  idKaryawan?: string | number | null;
  nama?: string;
  tanggal?: string;
  waktuMasuk?: string | null;
  waktuKeluar?: string | null;
  status?: string | null;
  lokasi?: string | null;
  mode_kerja?: string | null;
  jamPulangSeharusnya?: string | null;
  kompensasi_lembur?: string | null;
  kompensasi_dari?: string | null;
  lembur_menit?: number | string | null;
  foto_masuk?: string | null;
  foto_keluar?: string | null;
};

export type BarisKaryawan = {
  idKaryawan?: string | number | null;
  id_karyawan?: string | number | null;
  id?: string | number | null;
  nama?: string;
  jabatan?: string | null;
  jamMasuk?: string | null;
  sisaCuti?: number | null;
};

export type BarisPengajuan = {
  id: string;
  idKaryawan?: string;
  nama?: string;
  jenis?: string;
  tanggal?: string;
  alasan?: string | null;
  status?: string;
};

export type BarisTugas = {
  id?: string | number;
  title?: string | null;
  status?: string | null;
  publish_at?: string | null;
};
