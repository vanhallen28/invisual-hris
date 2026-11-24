# Gerbang Section Management — catatan (25 Nov 2026)

Permintaan: Section Management dipakai sebagai bahan presentasi dulu, jadi **hanya akun @invisual.studio** yang bisa melihatnya. Setelah tim Management ditambahkan di tab Anggota dan siap, HR menyalakan sakelar di **Pengaturan**, dan baru saat itu anggota Management bisa melihat serta membukanya.

## Perilaku
| Sakelar `mgmt_terbuka_anggota` | Akun @invisual.studio (HR, master, owner) | Anggota Management lain | Karyawan lain |
|---|---|---|---|
| MATI (bawaan setelah SQL) | Management lengkap | Tanpa menu Management; RPC ditolak; tabel tak terbaca; tanpa pengingat pagi | Tanpa menu & banner Pedoman |
| NYALA | Management lengkap | Seperti P1+P2 | Melihat Pedoman yang berlaku (seperti P1) |

Mengubah sakelar tidak mengubah atau menghapus data.

## Komponen
- **SQL** `management-gerbang.sql`:
  - fungsi `mgmt_terbuka()` = `adalah_hr()` (email @invisual.studio) **atau** sakelar = 'true';
  - cabang anggota di `mgmt_peran_saya` / `mgmt_divisi_saya` hanya dihitung bila terbuka. Semua RPC Management lewat `mgmt__wajib_anggota`, jadi ikut tertutup;
  - pagar RLS **RESTRICTIVE** `mgmt_gerbang` di 10 tabel `mgmt_*`;
  - kunci sakelar dibuat `false`.
- **Pengaturan (admin)**: kartu "Section Management untuk anggota" (`components/management/SakelarGerbang.tsx`). Kartu hanya tampil untuk akun @invisual.studio, dan hanya HR (RLS `pengaturan`) yang bisa menulis. Sebelum SQL dijalankan, kartu menampilkan "Belum berlaku" dan sakelar nonaktif.
- **Tab Anggota**: catatan "Belum dibuka untuk anggota" selama sakelar mati.
- **Pengingat pagi** (`lib/management/pengingat.ts`): saat sakelar mati, hanya akun @invisual.studio yang dikirimi pengingat, tanpa pengingat soal staf yang belum membaca Pedoman. Sebelum SQL dijalankan, perilaku tetap seperti semula.
- Pustaka: `lib/management/gerbang.ts` (`statusGerbang`, `simpanGerbang`, `gerbangTerbukaServer`).

## Pengujian
- **SQL lokal:**
  - gerbang 33 cek (pasang 2× idempoten; MATI/NYALA/MATI lagi; non-studio tak bisa mengubah sakelar; data utuh);
  - P2 87/87 dan P1 148/149 dengan gerbang terpasang dan sakelar NYALA. Satu cek P1 yang berbeda menghitung kunci `pengaturan`, yang memang bertambah satu.
- **Unit:** gerbang 5; pengingat 9 (termasuk skenario tertutup, terbuka, belum dipasang, dan galat).
- **e2e:** 18 cek (kartu Pengaturan, upsert, catatan Anggota, menu karyawan/anggota saat tertutup).
- **A/B piksel** tema gelap terhadap build sebelumnya. Halaman yang memang berubah: Pengaturan (kartu baru) dan tab Anggota (catatan, hanya saat SQL terpasang dan sakelar mati).

## Cara pasang
1. Kode: unzip `management-gerbang.zip` → `npm install && npm run build` → commit & push. Tanpa SQL, perilaku tetap sama; di Pengaturan muncul kartu berlabel "Belum berlaku".
2. SQL: jalankan `management-gerbang.sql` di Supabase SQL Editor. Sejak saat itu hanya @invisual.studio yang melihat Management & Pedoman.
3. Tambah tim di Management → Anggota. Bila sudah siap, buka Pengaturan dan nyalakan "Section Management untuk anggota".

## Darurat
Nyalakan sakelar untuk kembali ke perilaku sebelum gerbang. Untuk mencabut gerbang sepenuhnya, lihat bagian akhir `management-gerbang.sql`.
