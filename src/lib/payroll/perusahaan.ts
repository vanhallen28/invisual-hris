// src/lib/payroll/perusahaan.ts
// Identitas perusahaan di slip gaji (HTML, PDF, email) — satu-satunya sumber.
// Ubah di sini bila alamat/telepon berganti; semua slip ikut berubah.
export const PERUSAHAAN = {
  nama: "Invisual Studio",
  departemen: "HR & Payroll Department",
  alamat: "Jl. Golf Bar. XVII No.8, Sukamiskin, Kec. Arcamanik, Kota Bandung, Jawa Barat 40293",
  telepon: "0822-9555-5314",
} as const;
