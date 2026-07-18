// src/lib/owners.ts
// Daftar akun Owner. Owner setara admin, TAPI dikecualikan dari statistik
// operasional (headcount Dasbor, Payroll, dsb) karena bukan staf operasional.

export const OWNER_EMAILS = [
  "dea@invisual.studio",
  "riza@invisual.studio",
  "tryan@invisual.studio",
];

export const isOwnerEmail = (email?: string | null) =>
  !!email && OWNER_EMAILS.includes(String(email).trim().toLowerCase());

/** Buang record Owner dari daftar karyawan (untuk perhitungan statistik). */
export const excludeOwners = <T extends { email?: string | null }>(list: T[] | null | undefined): T[] =>
  (list || []).filter((e) => !isOwnerEmail(e?.email));
