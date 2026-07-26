// src/lib/tracker/gulir.ts
//
// Menjaga posisi gulir tetap benar walaupun isinya masih tumbuh.
//
// MASALAH YANG DIPECAHKAN
// Cara lama: `setTimeout(() => el.scrollTo(...), 60)`. Enam puluh milidetik
// itu tebakan. Kalau di dalam daftar ada gambar yang belum selesai diunduh,
// tingginya masih 0 saat gulir dijalankan — begitu gambar muncul, halaman
// memanjang dan posisi gulir jadi berhenti di tengah. Di Setoran Daily ini
// hampir selalu terjadi, karena isinya gambar semua.
//
// CARANYA
// Bukan menebak jeda, tapi MENDENGARKAN: setiap kali ada gambar selesai
// termuat (atau gagal), posisi gulir dipasang ulang. Berhenti sendiri
// setelah batas waktu, dan berhenti SEGERA kalau penggunanya mulai
// menggulir sendiri — supaya tidak pernah merebut kendali dari tangan orang.

/**
 * @param wadah     elemen yang bisa digulir
 * @param hitung    menghitung nilai scrollTop yang diinginkan, dipanggil ulang
 *                  setiap kali tinggi isi berubah
 * @param batasMs   berhenti otomatis setelah sekian milidetik
 * @returns         fungsi untuk menghentikan lebih awal
 */
export function guliranStabil(
  wadah: HTMLElement,
  hitung: (el: HTMLElement) => number,
  batasMs = 4000,
): () => void {
  let aktif = true;
  let rafId = 0;
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const terapkan = () => {
    if (!aktif || !wadah.isConnected) return;
    wadah.scrollTop = hitung(wadah);
  };

  const berhenti = () => {
    if (!aktif) return;
    aktif = false;
    cancelAnimationFrame(rafId);
    if (timerId) clearTimeout(timerId);
    wadah.removeEventListener('wheel', berhenti);
    wadah.removeEventListener('touchstart', berhenti);
    wadah.removeEventListener('load', terapkan, true);
    wadah.removeEventListener('error', terapkan, true);
  };

  // Pengguna menggulir sendiri → jangan diganggu lagi.
  wadah.addEventListener('wheel', berhenti, { passive: true });
  wadah.addEventListener('touchstart', berhenti, { passive: true });

  // `load` tidak menggelembung, jadi harus disadap di fase CAPTURE.
  wadah.addEventListener('load', terapkan, true);
  wadah.addEventListener('error', terapkan, true);

  terapkan();
  rafId = requestAnimationFrame(() => {
    terapkan();
    rafId = requestAnimationFrame(terapkan);
  });
  timerId = setTimeout(berhenti, batasMs);

  return berhenti;
}

/** Nilai scrollTop untuk menempel di dasar daftar. */
export const keDasar = (el: HTMLElement) => el.scrollHeight;

/**
 * Nilai scrollTop supaya `penanda` berada di dekat atas layar.
 * Memakai getBoundingClientRect, bukan offsetTop, karena offsetTop
 * bergantung pada leluhur ber-`position` — gampang meleset kalau tata
 * letaknya berubah.
 */
export function kePenanda(el: HTMLElement, penanda: HTMLElement | null, ruangAtas = 56): number {
  if (!penanda || !penanda.isConnected) return keDasar(el);
  const selisih = penanda.getBoundingClientRect().top - el.getBoundingClientRect().top;
  return el.scrollTop + selisih - ruangAtas;
}
