// src/lib/types.ts

export type EmployeeStatus = "PKWT" | "Tetap Percobaan" | "Tetap Permanen";

export interface DocumentItem {
  id: string;
  judul: string;
  namaFile: string;
  tanggal: string;
  ukuran: string;
}

export interface Employee {
  nama: string;
  idKaryawan: string;
  statusKaryawan: EmployeeStatus;
  tanggalBergabung: string;
  masaKerja: string;
  pangkat: string;
  jabatan: string;
  jadwal: string;
  lokasiKantor: string;
  organisasi: string;
  tanggalMasaAkhirKerja: string;
  masaAkhirKerja: string;
  nikKtp: string;
  tanggalLahir: string;
  statusPerkawinan: string;
  agama: string;
  golonganDarah: string;
  email: string;
  noPonsel?: string;
  alamatIdentitas: string;
  alamatDomisili: string;
  kontakDarurat: string;
  slipGaji: string;
  npwp: string;
  statusPajak: string;
  bpjsKetenagakerjaan: string;
  namaUser: string;
  emailLogin: string;
  peran: string;
  loginTerakhir: string;
  perangkatLogin: string;
  isAktif?: boolean;
  gajiPokok?: number;
  insentif?: number;
  namaBank?: string;
  noRekening?: string;
  sisaCuti?: number;
  dokumen?: DocumentItem[];
}