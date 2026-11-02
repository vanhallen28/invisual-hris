# Akses login terpisah dari Arsip (tutup akses eks magang/karyawan) — rancangan (2 Nov 2026)

Disetujui pengguna 2 Nov 2026 per bagian ("setuju yang A", "ya sesuai", "oke lanjut"). Penyesuaian terakhir: "biar HR sendiri yang rubah, anda tinggal sediakan saja opsi dan menu nya". Karena itu, semua keputusan (siapa ditutup, penutupan otomatis nyala/mati, peran manager) diambil HR lewat menu; sistem tidak mengubah apa pun sendiri sampai HR menyalakannya.

Pilihan pengguna:
- Berlaku untuk semua karyawan nonaktif, bukan hanya magang.
- Eks karyawan tidak bisa masuk sama sekali.
- Penutupan otomatis sekaligus manual (satu tombol).
- Sebagian akun arsip tetap boleh akses: akses penuh, atau freelancer yang tidak wajib absen.

## Latar (dicek di database 2 Nov 2026, baca saja)
- 7 karyawan berstatus `Internship`, semuanya `isAktif = true` dan punya login. 6 di antaranya sudah lewat `tanggalSelesaiMagang`.
- 13 akun `isAktif = false` masih bisa login (`banned_until` kosong). Rinciannya:
  - 9 orang login dalam 30 hari terakhir;
  - ke-13 masih ada di `members`, 3 di antaranya `role = manager` sehingga lolos `pp_staf` dan bisa melihat kehadiran/pengajuan semua orang;
  - 6 masih tergabung di kanal chat.
- 6 dari 13 akun arsip adalah freelancer (`isFreelancer`). Mereka diarsip agar tidak dihitung di statistik/absen, tetapi masih bekerja lewat Daily Task dan Chat.
- Akar masalah: "Arsip" (`isAktif`) dipakai untuk dua arti sekaligus, yaitu "tidak dihitung di daftar/absen" dan "sudah keluar".
  - Login email+password tidak memeriksa `isAktif`; callback Google memeriksanya.
  - RLS tidak memeriksa keduanya.
- `pg_cron` sudah terpasang. Role `postgres` boleh `UPDATE auth.users` (kolom `banned_until` ada) dan `DELETE auth.sessions`.

## Model data — `akses-login.sql`
Kolom baru di `employees`:
- `aksesLogin text not null default 'aktif'`, dengan check `in ('aktif','ditutup')`;
- `aksesDitutupPada timestamptz`, `aksesDitutupOleh text` (email HR atau `'otomatis'`), `aksesAlasan text` (`magang selesai` | `kontrak berakhir` | `keluar` | `lainnya`);
- `tetapAksesSampai date`: pengecualian penutupan otomatis selama tanggal ini ≥ hari ini (WIB).

`isAktif` (Arsip) dan `isFreelancer` **tidak berubah arti**. Kombinasi yang didukung:

| Kasus | isAktif | isFreelancer | aksesLogin |
|---|---|---|---|
| Karyawan biasa | true | – | aktif |
| Diarsip, tetap akses penuh | false | false | aktif |
| Freelancer (tidak wajib absen) | false | true | aktif |
| Eks magang / eks karyawan | false | – | ditutup |

## Aturan
- **Otomatis (opsi HR, bawaan MATI)** — sakelar baru di Pengaturan › Absensi: **"Tutup akses otomatis saat magang/kontrak berakhir"** (`pengaturan.kunci = 'akses_tutup_otomatis'`, nilai `'true'|'false'`, bawaan `'false'`). Fungsi `tutup_akses_kedaluwarsa()` dijalankan pg_cron setiap hari pukul `5 17 * * *` UTC (00:05 WIB), dan **tidak melakukan apa pun bila sakelar mati**. Saat menyala, fungsi ini menutup baris yang memenuhi semua syarat berikut:
  - `aksesLogin = 'aktif'`;
  - `tanggalSelesaiMagang < hari ini WIB` **atau** `tanggalBerakhirKontrak < hari ini WIB`;
  - `tetapAksesSampai is null or tetapAksesSampai < hari ini WIB`;
  - email bukan `%@invisual.studio` (akun HR/owner tidak pernah ditutup otomatis).

  Alasan diisi sesuai kolom yang memicu, dan `aksesDitutupOleh = 'otomatis'`.
- **Manual** — RPC `atur_akses_login(p_idk text, p_aksi text, p_alasan text, p_sampai date, p_arsipkan boolean)`, `security definer`:
  - hanya bisa dipanggil HR (`adalah_hr()`);
  - menolak bila target adalah akun pemanggil sendiri;
  - `tutup` mengisi kolom jejak, dan `p_arsipkan` ikut menyetel `isAktif=false`;
  - `buka` mengembalikan ke `aktif`, mengosongkan jejak, dan menyimpan `p_sampai` ke `tetapAksesSampai`. RPC **menolak** `buka` bila tanggal magang/kontrak sudah lewat sementara `p_sampai` kosong atau sudah lewat, karena akun akan tertutup lagi malam itu juga.
- `isAktif` tidak pernah diubah oleh aturan otomatis. Arsip tidak menutup akses; tutup akses mengarsip hanya bila HR mencentang "Sekalian arsipkan".
- **Saat pemasangan tidak ada akun yang ditutup**, dan sakelar otomatis mati. HR melihat daftarnya di aplikasi lalu memutuskan sendiri: menutup per orang, memberi pengecualian, dan/atau menyalakan sakelar.
- Peran manager (17 akun) **tidak** diubah. Menunya sudah ada di form Karyawan (Role Tracker: member/manager); HR yang menyesuaikan.

## Penegakan (tiga lapis)
1. **Blokir akun login.** Trigger `AFTER UPDATE OF "aksesLogin"` pada `employees` (security definer) bekerja sebagai berikut:
   - Saat `ditutup`:
     - `auth.users.banned_until = 'infinity'` untuk `user_id`;
     - hapus `auth.sessions` dan `auth.refresh_tokens` milik akun itu;
     - hapus `push_subscriptions` (`member_id = user_id`);
     - catat ke `audit_log`.
   - Saat `aktif`: `banned_until = null`, lalu catat ke `audit_log`.
   - Baris tanpa `user_id` hanya mengubah kolom.
2. **Pagar RLS** — fungsi `akses_terbuka()` (stable, security definer) bernilai false hanya bila ada baris `employees` dengan `user_id = auth.uid()` dan `aksesLogin = 'ditutup'`.
   - Satu kebijakan **RESTRICTIVE** `pagar_akses_login` (`for all to authenticated using/with check ((select public.akses_terbuka()))`) dipasang lewat loop pada **setiap tabel `public` ber-RLS**, dan juga pada `storage.objects`.
   - View `employees_publik` dibuat ulang (logika kolom sama dengan Tahap 2) dengan tambahan `and public.akses_terbuka()`.
   - Kebijakan yang sudah ada tidak diubah, dan service role tidak terpengaruh.
   - Sisa yang diterima: RPC `security definer` lama (mis. `pp_kontak`) masih bisa dipanggil dengan tiket login yang belum kedaluwarsa (≤ 1 jam), dan hanya menyentuh data milik akun itu sendiri.
3. **Aplikasi.**
   - Fungsi `status_akses_saya()` mengembalikan `'aktif' | 'ditutup' | 'tidak_terdaftar'` dan bisa dipanggil walau terpagar.
   - Halaman login memetakan galat Supabase `user_banned` ke pesan "Akses akun Anda sudah ditutup. Hubungi HR bila ini keliru."
   - Callback Google memeriksa `aksesLogin` (bila kolom ada), bukan lagi `isAktif`, supaya freelancer/akun arsip yang aksesnya aktif tetap bisa masuk lewat Google. Bila kolom belum ada, tetap memakai `isAktif` seperti sekarang.
     - Konsekuensi peralihan: 7 akun arsip non-freelancer yang selama ini ditolak di jalur Google akan bisa masuk lewat Google sampai HR menutupnya. Lewat password mereka sudah bisa masuk sejak awal, jadi celahnya tidak bertambah. Panel "Diarsip tapi akses masih aktif" dibuat untuk ditinjau pada hari pemasangan.
   - Layout HR dan karyawan memanggil `status_akses_saya()` sekali saat dimuat. Bila hasilnya `ditutup`: `hapusSesiLokal()` → `signOut()` → `/login?akses=ditutup`. Bila RPC belum ada atau galat jaringan, layout diam.
   - `/api/employees` menambah `aksesLogin`, `aksesDitutupPada`, `aksesDitutupOleh`, `aksesAlasan` ke `KOLOM_TERLARANG`, sehingga satu-satunya jalur ubah adalah RPC.
   - `/api/push/send` tidak perlu diubah: trigger sudah menghapus langganan push akun yang ditutup, dan pagar mencegah akun itu mendaftar ulang.

## Tampilan HR — halaman Karyawan (tema Gelap & Neo-Brutal, ponsel)
- Tombol per baris **🔒 Tutup akses / 🔓 Buka akses**, di daftar Aktif maupun Arsip (ditonjolkan di Arsip). Lencana merah "Akses ditutup"; lencana Freelancer tetap ada.
- Dialog **Tutup akses**:
  - nama orang dan akibatnya;
  - Alasan (wajib);
  - "Sekalian arsipkan" (tercentang bila masih Aktif);
  - konfirmasi tambahan untuk akun owner (`OWNER_EMAILS`).
  - Tombolnya tidak tampil untuk akun HR yang sedang login.
- Dialog **Buka akses**: tanggal "Tetap akses sampai", wajib bila magang/kontrak sudah lewat.
- **Panel pengingat** di atas daftar (menyatu dengan pengingat kontrak H-7):
  - "Magang/kontrak sudah berakhir, akses masih aktif": aturan yang sama dihitung di klien lewat `lib/aksesLogin.ts`, fungsi murni yang menjadi cermin SQL. Per orang ada tombol "Tutup sekarang" dan "Beri pengecualian". Bila sakelar otomatis menyala, judulnya menjadi "Akses ditutup otomatis malam ini (00:05)", dan panel menampilkan tautan ke sakelar di Pengaturan.
  - "Magang/kontrak berakhir ≤ 7 hari": mencakup `tanggalSelesaiMagang`.
  - "Diarsip tapi akses masih aktif" (bisa dilipat), dengan tanda freelancer.
- Form ubah karyawan memuat bagian "Akses login": status, tanggal berakhir, dan "Tetap akses sampai". Perubahan disimpan lewat RPC, bukan PATCH.
- Detail profil menampilkan "Akses ditutup 3 Nov 2026 · otomatis · magang selesai".
- Bila kolom belum ada (SQL belum dijalankan), semua elemen akses tersembunyi dan halaman bekerja seperti sekarang.

## Pemasangan
Zip kode dipasang dulu (aman sebelum SQL), lalu `akses-login.sql`:
- satu transaksi;
- idempoten;
- ada bagian darurat untuk melepas pagar, menghapus jadwal, dan membuka semua blokir.

Pengguna yang menjalankan SQL sendiri, atau Claude yang menjalankannya lewat koneksi Supabase **hanya setelah pengguna bilang "jalankan"**. Setelah itu verifikasi dengan kueri baca saja.

## Pengujian
- **SQL** di Postgres 16 lokal dengan tiruan Supabase (`auth.users/sessions/refresh_tokens`, storage, keadaan kebijakan Tahap 2):
  - tutup → ban, sesi dan push terhapus, pagar menolak di semua tabel dan storage serta view;
  - buka → pulih;
  - sakelar mati → fungsi otomatis tidak mengubah apa pun; sakelar nyala → magang lewat ditutup; pengecualian dilewati; kontrak lewat ditutup; freelancer arsip tanpa tanggal tidak tersentuh; `@invisual.studio` tidak tersentuh;
  - RPC menolak non-HR, diri sendiri, dan buka tanpa pengecualian saat tanggal lewat;
  - HR, karyawan aktif, dan freelancer aktif tidak terpengaruh;
  - dijalankan 2×; galat membatalkan semua;
  - jadwal cron terdaftar sekali.
- **Unit**: `lib/aksesLogin.ts` sama persis dengan aturan SQL (batas tanggal WIB).
- **e2e** (mock): tombol tutup/buka, dialog dan validasinya, panel malam ini dan pengecualian, pesan login `user_banned`, layout mengeluarkan akun `ditutup`, callback Google mengizinkan akun arsip yang aksesnya aktif. Ditambah regresi suite yang ada.
- Pengaturan: sakelar tersimpan dan terbaca; panel berganti judul sesuai sakelar.
- tsc dan lint sama dengan baseline; tema gelap dibandingkan piksel (sebelum/sesudah, hari yang sama).
- Tinjauan independen sebelum dikirim.

## Di luar cakupan
- Menghapus akun login.
- Mengarsip otomatis.
- Mode "masuk terbatas".
- Mengubah perilaku freelancer di Chat/Daily Task.
- Merapikan 17 akun `manager` yang aktif. Ini dicatat sebagai temuan terpisah: peran manager memberi akses kehadiran semua orang.

## Revisi setelah tinjauan independen (2 Nov 2026)
- Pencocokan akun memakai `user_id` **atau** email/emailLogin (fungsi `baris_saya`, sama seperti `idk_saya()`): pagar, `status_akses_saya`, pemeriksa diri sendiri, dan blokir akun login. Baris tanpa `user_id` tetap terkunci.
- Aturan "masa berakhir" (`alasan_akses_berakhir`, dicerminkan `alasanKedaluwarsa`): magang hanya untuk status Internship/Magang, kontrak hanya untuk PKWT/Kontrak. Tanggal sisa di status lain (mis. magang yang sudah jadi Tetap) diabaikan.
- Akun HR (`akun_hr`): `@invisual.studio` di `email` **atau** `emailLogin`. Tidak pernah ditutup otomatis, tidak wajib pengecualian saat dibuka, tidak muncul di daftar "Diarsip tapi akses masih aktif", dan menutupnya manual butuh centang konfirmasi.
- `buka` memakai pengecualian lama yang masih berlaku bila tanggal baru dikosongkan.
- HR yang aksesnya ditutup tidak bisa memakai `atur_akses_login` walau tiketnya belum kedaluwarsa.
- Trigger juga berjalan saat INSERT (baris baru berstatus `ditutup` langsung diblokir). Membuka akses hanya mencabut blokir buatan fitur ini (±100 tahun).
- `lock_timeout 10s` saat pemasangan. View memanggil `(select akses_terbuka())` sekali per kueri dan kini hanya SELECT untuk authenticated (sebelumnya ikut INSERT/UPDATE/DELETE — celah tulis lewat view tertutup; aplikasi hanya membaca view ini).
- Tombol akses disembunyikan sampai email HR yang login diketahui.
- Sisa yang diterima: tiket login yang masih berlaku (≤ ±1 jam) masih bisa memanggil fungsi lama yang melewati RLS (`pp_kontak`, `pp_buka_utas`) — tabel tetap terpagar; tab yang sudah terbuka diperiksa saat dimuat.
- Blokir memakai `banned_until = now() + 100 tahun` (bukan `'infinity'`). `/api/push/send` tidak diubah: trigger sudah menghapus langganan dan pagar mencegah daftar ulang.

## Status (2 Nov 2026)
Kode + SQL selesai dan diuji, **belum dipasang**: SQL lokal 65 cek, unit 9, e2e 44, A/B piksel tema gelap identik (17 halaman × desktop/ponsel; dengan kolom, beda hanya Karyawan & Pengaturan), tsc sama dengan baseline. Berkas: `akses-login.zip` (pasang dulu) lalu `akses-login.sql`.
Data produksi saat ini (baca saja): 6 eks magang sudah lewat tanggal (semua diarsip) dan 4 akun arsip non-freelancer lain akan tampil di panel; 6 freelancer arsip punya tanggal kontrak — bila sakelar dinyalakan, mereka ikut tertutup saat kontraknya lewat kecuali diberi pengecualian.
