# Akses Login Terpisah dari Arsip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HR dapat menutup/membuka akses login per karyawan (manual + sakelar otomatis opsional) tanpa menghapus data karyawan, terpisah dari status Arsip.

**Architecture:**
- Penegakan ada di database:
  - kolom `aksesLogin` di `employees`;
  - trigger yang memblokir/membuka `auth.users`, menghapus sesi dan push;
  - pagar RLS RESTRICTIVE di semua tabel;
  - RPC `atur_akses_login` sebagai satu-satunya jalur ubah;
  - fungsi pg_cron yang patuh pada sakelar `pengaturan`.
- Aplikasi hanya menyediakan menu (komponen baru `components/admin/AksesLogin.tsx`), pesan login, dan pemeriksa layout. Semuanya diam bila SQL belum dijalankan.

**Tech Stack:** Next.js 16.4.2 (client components), supabase-js, Postgres 17 (Supabase) + pg_cron, Tailwind v4 + `neo-brutal.css`.

## Global Constraints
- Jangan mengubah fitur lain; tema gelap halaman lain identik (A/B piksel).
- Tidak ada akun yang ditutup saat pemasangan; sakelar otomatis bawaan `'false'`.
- Akun `%@invisual.studio` tidak pernah ditutup otomatis; HR tidak bisa menutup dirinya sendiri.
- SQL: satu transaksi, idempoten, ada bagian darurat.
- Kode aman dipasang sebelum SQL (kolom/RPC tidak ada → elemen akses tersembunyi, perilaku lama).
- Bahasa UI Indonesia; zip berisi path `src/...`.

---

### Task 1: `akses-login.sql` + uji Postgres lokal
**Files:**
- Create: `/mnt/attach/outputs/akses-login.sql`
- Create: `$S/pgtes/stub-akses.sql`
- Create: `$S/pgtes/uji-akses.sh`

**Produces (dipakai Task 2–5):**
- kolom `"aksesLogin" text` (`'aktif'|'ditutup'`), `"aksesDitutupPada" timestamptz`, `"aksesDitutupOleh" text`, `"aksesAlasan" text`, `"tetapAksesSampai" date`;
- `public.atur_akses_login(p_idk text, p_aksi text, p_alasan text default null, p_sampai date default null, p_arsipkan boolean default false) returns json`, yang mengembalikan `{ok:true}` atau melempar galat dengan pesan Indonesia;
- `public.status_akses_saya() returns text` (`'aktif'|'ditutup'|'tidak_terdaftar'`);
- `public.akses_terbuka() returns boolean`;
- `public.tutup_akses_kedaluwarsa() returns int` (jumlah yang ditutup);
- kunci `pengaturan` `'akses_tutup_otomatis'`;
- job pg_cron `'tutup-akses-harian'` pada `'5 17 * * *'`.

Langkah:
- [ ] Tulis stub Supabase meniru DB pengguna: `auth.users` (+`banned_until`), `auth.sessions`, `auth.refresh_tokens`, `auth.uid()`/`auth.jwt()`, `storage.objects`, tabel `employees`/`members`/`attendance`/`push_subscriptions`/`audit_log`/`pengaturan`, `adalah_hr()`, `pp_staf()`, view `employees_publik`, beberapa kebijakan Tahap 2, dan skema `cron` tiruan (`cron.schedule`, `cron.unschedule`, `cron.job`).
- [ ] Tulis `uji-akses.sh` (harus gagal sebelum SQL ada) yang memeriksa:
  - pemasangan 2× tanpa galat, dan tidak ada akun ditutup setelah pasang;
  - RPC tutup oleh HR → `banned_until='infinity'`, sesi/refresh/push terhapus, audit tercatat;
  - pagar: akun tertutup mendapat 0 baris di `attendance`/`employees`/view dan ditolak saat insert; karyawan aktif dan HR tidak terpengaruh;
  - `status_akses_saya()` = `'ditutup'` walau terpagar;
  - RPC menolak non-HR, menolak diri sendiri, dan menolak `buka` tanpa pengecualian saat tanggal lewat;
  - `buka` dengan `p_sampai` → ban dicabut;
  - sakelar `false` → otomatis 0; sakelar `true` → magang lewat ditutup, pengecualian dilewati, kontrak lewat ditutup, freelancer arsip tanpa tanggal dan `@invisual.studio` tidak tersentuh;
  - job cron terdaftar tepat 1;
  - galat di tengah → seluruh transaksi batal.
- [ ] Tulis SQL sampai semua cek lulus.

### Task 2: `src/lib/aksesLogin.ts` (aturan murni + akses data) + unit test
**Produces:**
- `hariIniWib(now?: Date): string` dalam format `YYYY-MM-DD`;
- `alasanKedaluwarsa(e, hari): 'magang selesai'|'kontrak berakhir'|null`;
- `adaPengecualian(e, hari): boolean`;
- `akanDitutupOtomatis(e, hari): boolean` (cermin SQL);
- `bukaPerluPengecualian(e, hari): boolean`;
- `aksesDitutup(e): boolean`;
- `kolomAksesAda(rows): boolean`;
- `aturAksesLogin(sb, {idKaryawan, aksi, alasan?, sampai?, arsipkan?}): Promise<{ok:boolean; pesan?:string}>`;
- `statusAksesSaya(sb): Promise<'aktif'|'ditutup'|'tidak_terdaftar'|null>` (`null` = RPC tidak ada / galat);
- `bacaSakelarOtomatis(sb): Promise<boolean>`;
- `simpanSakelarOtomatis(sb, nyala): Promise<boolean>`.

Langkah:
- [ ] Tulis unit test `node --experimental-strip-types` dengan kasus yang sama seperti uji SQL, ditambah batas WIB (23:30 UTC = hari berikutnya di WIB).
- [ ] Implementasikan sampai lulus.

### Task 3: Menu HR — `src/components/admin/AksesLogin.tsx` + halaman Karyawan + Pengaturan
**Produces komponen:**
- `LencanaAkses({emp})`;
- `TombolAkses({emp, onBuka})`;
- `DialogAkses({emp, sayaEmail, onTutup, onSelesai})`;
- `PanelAkses({employees, onPilih})`;
- `BagianAksesForm({emp, onUbah})`;
- `KeteranganAkses({emp})`;
- `KartuAksesOtomatis()`.

Perubahan:
- `src/app/admin/karyawan/page.tsx`:
  - import;
  - state `aksesTarget`;
  - lencana di sel Jabatan & Status (desktop) dan baris status (ponsel);
  - tombol di kolom Tindakan (desktop) dan baris aksi (ponsel);
  - `PanelAkses` setelah panel pengingat kontrak (pengingat H-7 ditambah magang);
  - `KeteranganAkses` di profil bagian B;
  - `BagianAksesForm` setelah kartu Status Karyawan;
  - `DialogAkses` di akhir.
- `src/app/admin/pengaturan/page.tsx`: `<KartuAksesOtomatis />` setelah kartu Blokir Clock-Out Telat.
- Semua elemen hanya tampil bila `kolomAksesAda(employees)`.

### Task 4: Login, callback, layout, API
- `src/app/(auth)/login/page.tsx`: bila galat signIn ber-`code === 'user_banned'` atau pesannya `/banned/i`, tampilkan "Akses akun Anda sudah ditutup. Hubungi HR bila ini keliru." Tampilkan juga pesan ini bila URL memuat `?akses=ditutup`.
- `src/app/(auth)/callback/page.tsx`: bila `emp.aksesLogin !== undefined`, tolak hanya `aksesLogin === 'ditutup'`; selain itu tetap `!emp.isAktif`.
- `src/app/admin/layout.tsx` dan `src/app/user/layout.tsx`: setelah user ada, `statusAksesSaya(supabase)`. Bila `'ditutup'` → `hapusSesiLokal(); await supabase.auth.signOut(); location.replace('/login?akses=ditutup')`.
- `src/app/api/employees/route.ts`: `KOLOM_TERLARANG` ditambah 4 kolom akses dan `tetapAksesSampai`.
- (Push: tidak perlu diubah. Trigger menghapus langganan, dan pagar mencegah akun tertutup mendaftar ulang.)

### Task 5: Uji halaman + regresi + kemas
- `npm ci`; tsc & lint dibandingkan baseline (salinan asli di `$S/asli/`).
- Mock Supabase Playwright baru (`$S/e2e/mock.js`) dan `e2e/akses.js`:
  - tombol/dialog/validasi;
  - panel berganti judul sesuai sakelar;
  - lencana;
  - sakelar Pengaturan;
  - pesan login `user_banned`;
  - layout mengeluarkan akun `ditutup`;
  - callback mengizinkan akun arsip yang aksesnya aktif;
  - halaman berjalan normal tanpa kolom/RPC.
- Tangkap tema gelap halaman HR utama sebelum/sesudah (hari yang sama) dan bandingkan piksel; selisih hanya boleh di halaman Karyawan/Pengaturan.
- Tinjauan independen (agen terpisah) atas SQL + diff kode → perbaiki temuan.
- Kemas `akses-login.zip` (`src/...` + dokumen spec/plan). Perbarui `claude/akses-login.md`.
