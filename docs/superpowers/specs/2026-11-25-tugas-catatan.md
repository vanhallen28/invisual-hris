# Tugas Management & alur harian — catatan implementasi (25 Nov 2026)

Tahap B dari "Struktur & Tugas Management" (pratinjau disetujui 25 Nov 2026). Tahap A (Struktur) sudah dikirim terpisah.

## Masalah yang dijawab
- Leader belum punya tempat menulis **apa yang sedang dikerjakan**.
- Ringkasan Harian berdiri sendiri, terpisah dari pekerjaan sehari-hari.
- Tugas dari SM/PM masih tersebar di chat.

Tab **Tugas** menyatukan semuanya dalam satu alur searah.

| Langkah | Kapan | Isi |
|---|---|---|
| 1 Rencana pagi | sebelum 10.00 | Pilih maks. **3 fokus hari ini**: dari tugas yang diberikan, kartu serah terima yang masuk, atau tulis sendiri. Fokus yang belum selesai kemarin terbawa otomatis, satu kali per hari. |
| 2 Kerjakan | 10.00–17.30 | Ubah status fokus (Belum mulai / Sedang dikerjakan / Selesai), centang tugas rutin, selesaikan tugas yang diberikan. |
| 3 Ringkasan Harian | 17.30–18.00 | Hanya untuk leader. Isian **sudah terisi**: Selesai berisi fokus, tugas, dan serah terima yang selesai hari ini; Hambatan berisi fokus yang belum selesai ("judul — " tinggal ditambah alasan). Selama belum diubah, isian mengikuti data terbaru. |
| 4 Dibaca management | setelah kirim | SM, PM, HR, dan Dea membacanya di tab Harian, seperti sebelumnya. |

## Bagian "Tim" (SM, PM, dan akun @invisual.studio)
- **Kepatuhan tim hari ini**: per orang ditampilkan fokus beserta statusnya, status Ringkasan Harian, hitungan tugas rutin hari/minggu/bulan, serta jumlah tugas berjalan dan terlambat.
- **Semua tugas yang diberikan**: papan Berjalan / Terlambat / Selesai minggu ini. Tombol "Selesaikan" ada di setiap tugas. "Batalkan" (wajib dengan alasan) hanya untuk pemberi tugas atau SM.
- **+ Tugas baru**: penerima, judul, tenggat WIB (bawaan besok 18.00), dan catatan. Hanya SM/PM yang dapat memberi tugas; akun @invisual.studio terhitung SM/PM.
- **Lihat sebagai**: menampilkan halaman Tugas persis seperti yang dilihat orang itu, hanya baca. Tidak ada yang bisa diubah atau dikirim dari tampilan ini.

## Aturan
- Tabel: `mgmt_tugas`, `mgmt_fokus`, `mgmt_rutin_cek`, dan `mgmt_fokus_bawa` (penanda pembawaan sekali per hari, tidak terbaca langsung).
- **Baca**: semua anggota Management (transparan, seperti Serah Terima dan Harian). **Tulis** hanya lewat RPC; setiap tugas yang diberi, diselesaikan, atau dibatalkan tercatat di `audit_log`.
- Ikut gerbang Management: selama sakelar mati, hanya akun @invisual.studio yang bisa membaca dan menulis.
- **Tugas rutin** diambil dari Struktur → posisi dengan `peran_mgmt` = peran orang itu. Lewat `mgmt_rutin_peran()`, leader tetap bisa membaca rutin perannya walau Struktur ditutup (tanpa jobdesk/SOP).
  - Centang berlaku per periode (harian `YYYY-MM-DD`, mingguan `IYYY-Www`, bulanan `YYYY-MM`, WIB). Periode yang sudah lewat tidak bisa diubah.
  - Butir **otomatis** tidak bisa dicentang manual. Status otomatis memakai aturan yang sama dengan panel "Perlu tindakan", jadi keduanya selalu sepakat:
    - ringkasan harian terkirim;
    - tidak ada kartu masuk yang terlambat;
    - kartu merah sudah ditindaklanjuti;
    - usulan sudah diteruskan/diputuskan;
    - review Dea sudah diputuskan;
    - kalender bulan depan sudah diajukan.
  - "Cuti" tidak dapat dicek di sini dan tidak dihitung.
- **Perlu tindakan** (tab Ringkasan) mendapat dua item baru:
  - "Tugas untuk Anda": mendesak bila sisa < 4 jam.
  - "Tugas yang Anda berikan terlambat": untuk pemberi tugas.
- Tugas: kuning bila sisa < 25% durasi, merah bila lewat tenggat. Tenggat tidak boleh di masa lalu dan paling jauh 180 hari ke depan.

## Pengujian (25 Nov 2026)
- **SQL lokal:** 54 cek, mencakup:
  - pasang 2× idempoten;
  - hak beri/selesaikan/batal;
  - validasi tenggat;
  - transparansi baca dan tulis langsung ditolak;
  - maks. 3 fokus, rujukan ganda, urutan;
  - pembawaan fokus sekali per hari (fokus terbawa yang dihapus tidak muncul lagi);
  - centang rutin per periode, otomatis ditolak, periode lampau terkunci;
  - gerbang tertutup/terbuka.
- **Unit:** tugas 13. Termasuk `mingguIso` dicocokkan dengan `to_char(IYYY-"W"IW)` Postgres untuk 2020–2028, dan item Perlu tindakan baru. Semua suite lama lolos.
- **e2e:** 75 cek, mencakup:
  - belum dipasang (tab dan Perlu tindakan sama seperti sebelumnya);
  - alur leader pagi → kirim ringkasan;
  - lewat 18.00;
  - PM: Tim, beri tugas, batalkan, Lihat sebagai (tanpa tulis);
  - tautan dari Perlu tindakan;
  - akun studio tanpa baris anggota;
  - ponsel 390px tanpa gulir samping.
- **A/B piksel** tema gelap terhadap build Tahap A (Struktur): 50 tangkapan per skenario (lebar 1440 & 390; HR, PM, karyawan; termasuk tab Ringkasan, Serah Terima, Harian).
  - `tugas.sql` belum dijalankan: **50/50 identik**.
  - Sudah dijalankan: 38/50 identik. 12 halaman Management berbeda hanya di baris tab (tab "Tugas" bertambah); isi Ringkasan/Serah Terima/Harian tetap sama.

## Cara pasang
1. Kode: unzip `tugas.zip` → `npm install && npm run build` → commit & push. Tanpa SQL, tab Tugas tidak muncul dan halaman lain tidak berubah.
2. SQL: jalankan `tugas.sql` setelah `struktur.sql` (butuh management-p1.sql; gerbang otomatis ikut bila management-gerbang.sql sudah dijalankan).

## Darurat
`revoke select on public.mgmt_tugas, public.mgmt_fokus, public.mgmt_rutin_cek from authenticated;` membuat tab Tugas hilang. Data tetap utuh. Pulihkan dengan `grant select … to authenticated;`.
