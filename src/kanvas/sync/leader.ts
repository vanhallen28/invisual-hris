/**
 * Setiap klien memanggil ini dengan daftar id koneksi yang sedang
 * online dan harus sampai pada jawaban yang sama. Karena itu
 * pengurutannya total dan tidak bergantung urutan masukan.
 *
 * Kalau dua klien sempat melihat daftar berbeda dan keduanya
 * mengira dirinya leader, tidak ada kerusakan: snapshot berisi
 * keadaan penuh, jadi penulisan ganda hanya boros, bukan salah.
 */
export function pilihLeader(klienIds: string[]): string | null {
  if (klienIds.length === 0) return null
  return [...klienIds].sort()[0]
}
