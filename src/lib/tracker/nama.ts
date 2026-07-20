// Nama tampil untuk anggota tim.
// Kalau karyawan punya nama panggilan di data karyawan, itu yang dipakai di
// tempat sempit seperti chip PIC pada tabel. Kalau kosong, jatuh ke nama utuh.

export const namaPendek = (m: any): string =>
  String(m?.panggilan || '').trim() || String(m?.name || '').trim();

// Untuk pencarian: cocokkan ke nama utuh maupun panggilan, supaya
// mengetik "kinan" tetap menemukan orang yang dipanggil "Sendiko".
export const cocokNama = (m: any, q: string): boolean => {
  const kata = q.trim().toLowerCase();
  if (!kata) return true;
  return String(m?.name || '').toLowerCase().includes(kata)
      || String(m?.panggilan || '').toLowerCase().includes(kata);
};
