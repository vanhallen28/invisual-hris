# Section Management (P1–P2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun menu **Management** di HRIS, yang tersedia di kedua portal, bersama tab **Pedoman** wajib baca untuk semua karyawan. Cakupan rencana ini adalah prioritas P1 dan P2 dari `docs/superpowers/specs/2026-11-24-section-management-prd.md`:

| Prioritas | Isi |
|---|---|
| P1 | Anggota, Pedoman, Log Usulan, panel "Perlu tindakan" |
| P2 | Serah Terima, Ringkasan Harian, pengingat pagi |

**Architecture:**
- **Penegakan ada di database:**
  - tabel `mgmt_*` ber-RLS;
  - transisi status hanya lewat RPC `security definer`, yang memeriksa peran dan menulis `audit_log`;
  - fungsi hari kerja SQL;
  - job `pg_cron`.
- **Aturan murni** (hari kerja, transisi usulan, tenggat serah terima, daftar isi/diff Pedoman, hak per peran) ada di `src/lib/management/*.ts` sebagai **cermin SQL**, dan diuji dengan kasus yang sama.
- **UI:**
  - Satu komponen `components/management/Management.tsx`, dipasang di `/admin/management` dan `/user/management`.
  - Halaman `/user/pedoman` untuk karyawan non-management.
  - Banner wajib baca di kedua layout.
  - Semua elemen diam bila SQL belum dijalankan.

**Tech Stack:**

| Lapisan | Teknologi |
|---|---|
| Aplikasi | Next.js 16.4.2 (client components), React 19, supabase-js |
| Database | Postgres 17 (Supabase) + pg_cron |
| Tampilan | Tailwind v4 + `neo-brutal.css` |
| Notifikasi | web-push |
| Dependensi baru | `marked@^15` (dipakai juga di repo `invisual-project`) |

**Variabel jalur yang dipakai di rencana ini:**
- `$OUT` = folder keluaran sesi, misalnya `/mnt/attach/outputs`.
- `$S` = folder kerja uji di luar repo.

## Global Constraints

**Perilaku aplikasi lama**
- Jangan mengubah perilaku fitur lain.
- Halaman yang sudah ada dibandingkan piksel di tema gelap (A/B). Hasilnya **harus identik** bila SQL belum dijalankan.

**Pemasangan**
- Kode harus aman dipasang **sebelum** SQL. Bila tabel atau RPC `mgmt_*` belum ada, menu, banner, dan tab tersembunyi, dan aplikasi berperilaku seperti sekarang.
- SQL: satu transaksi per berkas, idempoten (bisa dijalankan 2×), `set local lock_timeout = '10s'`, dan ada bagian **darurat** di akhir sebagai komentar.
- Tidak ada SQL yang dijalankan ke produksi tanpa pengguna bilang **"jalankan"**. Verifikasi pascapasang memakai kueri baca saja.

**Akses dan peran**
- Akses Management **hanya** dari `mgmt_anggota` dan `OWNER_EMAILS`, **bukan** `members.role`.
- Pencocokan akun mengikuti pola `public.baris_saya(e employees)`: `user_id = auth.uid()`, atau email JWT sama dengan `email`/`emailLogin`.
- Peran: `studio_manager`, `pm`, `hr`, `leader_sosmed`, `leader_service`, `leader_marketplace`, `owner`.
- Hak per aksi mengikuti tabel "Hak per peran" di PRD.

**Pedoman**
- Pedoman: hanya satu versi `berlaku`. Versi baru wajib tertaut ke minimal satu usulan, kecuali v1.0 dengan `pengesahan_awal` oleh `studio_manager`.
- Konfirmasi baca **tidak memblokir** Clock In, Daily Task, maupun Chat.

**Hari kerja**
- Senin–Jumat, 09.00–18.00 WIB, tidak termasuk `hari_libur.libur = true`.
- 1 hari kerja = 9 jam kerja.
- Hari rapat mingguan bawaan: Senin (`pengaturan.mgmt_hari_rapat = '1'`).

**Status usulan**
- `diajukan`, `cek_dampak`, `siap_diputuskan`, `disetujui`, `uji_coba`, `ditolak`, `ditunda`, `berlaku`, `dicabut`, `diganti`, `berlaku_darurat`, `gugur`, `masa_keberatan`.

**Bahasa dan tampilan**
- Bahasa UI Indonesia, mengikuti `docs/glosarium-istilah.md`. Pakai **Usulan**, bukan "Pengajuan".
- Tanggal ditampilkan lewat `teksTanggal`/`teksTanggalISO` dari `src/lib/tanggalTampil.ts`.
- Dialog memakai `useJebakFokus` dari `src/lib/fokus.ts`.
- Status tidak hanya dibedakan dengan warna; selalu ada label teks.

**Pengujian**
- Fungsi murni di `src/lib/management/*.ts` **tidak memakai alias `@/`** dan hanya `import type` dari luar folder.
- Dengan begitu bisa diuji dengan `node --experimental-strip-types --test`.

---

## Peta berkas

**SQL dan uji**

| Berkas | Tanggung jawab |
|---|---|
| `$OUT/management-p1.sql` | Tabel P1, fungsi peran, hari kerja, RPC usulan/Pedoman/anggota, RLS, cron |
| `$OUT/management-p2.sql` | Tabel P2 (serah terima, ringkasan harian), RPC, RLS |
| `$S/pgtes/stub-mgmt.sql`, `$S/pgtes/uji-mgmt-p1.sh`, `$S/pgtes/uji-mgmt-p2.sh` | Tiruan Supabase dan uji SQL |
| `$S/unit/*.test.ts` | Unit test fungsi murni |
| `$S/e2e/management.js` | e2e Playwright dengan mock Supabase |

**Pustaka (`src/lib/management/`)**

| Berkas | Tanggung jawab |
|---|---|
| `hariKerja.ts` | Hari kerja, tambah jam kerja, rapat berikutnya/sasaran (cermin SQL) |
| `akses.ts` | Tipe peran, matriks hak `bisa()`, muat peran saya (RPC) |
| `usulan.ts` | Status/transisi/nomor usulan (murni) + pemanggil RPC |
| `pedoman.ts` | Daftar isi, slug, bagian, diff baris (murni) + pemanggil data |
| `pedomanRender.ts` | Markdown ke HTML aman (marked + DOMPurify, khusus peramban) |
| `serahTerima.ts` (P2) | Tenggat per jenis, warna kartu, batas tindak lanjut (murni) + pemanggil RPC |
| `harian.ts` (P2) | Tepat waktu Ringkasan Harian, hari yang dihitung (murni) + pemanggil RPC |
| `perluTindakan.ts` | Daftar "Perlu tindakan saya" per peran (murni; dipakai UI dan pengingat) |

**Komponen (`src/components/management/`)**

| Berkas | Isi |
|---|---|
| `Management.tsx` | Kerangka tab |
| `TabRingkasan.tsx` | Tab Ringkasan |
| `PerluTindakan.tsx` | Panel "Perlu tindakan saya" |
| `TabPedoman.tsx` | Tab Pedoman |
| `EditorPedoman.tsx` | Editor dan penerbitan versi |
| `RiwayatPedoman.tsx` | Riwayat versi dan diff |
| `StatusBaca.tsx` | Status baca dan pemetaan divisi |
| `BannerPedoman.tsx` | Banner wajib baca |
| `TabUsulan.tsx` | Daftar usulan |
| `FormUsulan.tsx` | Formulir usulan |
| `DetailUsulan.tsx` | Detail, cek dampak, keputusan, keberatan |
| `KelolaAnggota.tsx` | Kelola anggota Management |
| `TabSerahTerima.tsx`, `FormSerahTerima.tsx` (P2) | Serah terima |
| `TabHarian.tsx` (P2) | Ringkasan Harian |

**Rute**

| Berkas | Isi |
|---|---|
| `src/app/admin/management/page.tsx`, `src/app/user/management/page.tsx` | Halaman Management |
| `src/app/user/pedoman/page.tsx` | Pedoman untuk karyawan non-management |
| `src/app/api/management/pengingat/route.ts` (P2) | Cron pengingat pagi |
| `src/lib/server/kirimPush.ts` (P2) | Pengiriman push, diekstrak dari `/api/push/send` tanpa perubahan perilaku |

**Berkas lama yang diubah**
- `src/app/admin/layout.tsx`
- `src/app/user/layout.tsx`
- `src/app/api/push/send/route.ts` (P2)
- `vercel.json` (P2)
- `package.json` (tambah `marked`)
- `docs/glosarium-istilah.md`

---

## P1

### Task 1: `management-p1.sql` + uji Postgres lokal

**Files:**
- Create: `$OUT/management-p1.sql`
- Create: `$S/pgtes/stub-mgmt.sql`
- Create: `$S/pgtes/uji-mgmt-p1.sh`

**Interfaces — Produces (dipakai Task 2–8):**

Tabel:

```sql
create table if not exists public.mgmt_anggota (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text not null,
  nama text not null,
  peran text not null check (peran in ('studio_manager','pm','hr','leader_sosmed','leader_service','leader_marketplace','owner')),
  divisi text null check (divisi in ('sosmed','service','marketplace')),
  aktif boolean not null default true,
  dibuat_pada timestamptz not null default now(),
  dibuat_oleh text,
  unique (email, peran)
);
create table if not exists public.mgmt_divisi_staf (
  id_karyawan text primary key,                 -- employees."idKaryawan"
  divisi text not null check (divisi in ('sosmed','service','marketplace','lainnya')),
  diubah_oleh text, diubah_pada timestamptz not null default now()
);
create table if not exists public.mgmt_pedoman_versi (
  id uuid primary key default gen_random_uuid(),
  versi text not null unique,                   -- 'v1.0'
  isi_md text not null,
  ringkasan_perubahan text not null default '',
  status text not null check (status in ('draf','berlaku','arsip')),
  berlaku_mulai date null,
  pengesahan_awal boolean not null default false,
  diterbitkan_oleh text null, diterbitkan_pada timestamptz null,
  dibuat_pada timestamptz not null default now()
);
create unique index if not exists mgmt_pedoman_satu_berlaku on public.mgmt_pedoman_versi ((status)) where status = 'berlaku';
create unique index if not exists mgmt_pedoman_satu_draf    on public.mgmt_pedoman_versi ((status)) where status = 'draf';
create table if not exists public.mgmt_usulan (
  id uuid primary key default gen_random_uuid(),
  nomor text not null unique,                   -- 'U-2026-001'
  judul text not null, masalah text not null, perubahan text not null,
  bagian_pedoman text not null,
  divisi_terdampak text[] not null,             -- subset {'sosmed','service','marketplace','hr','semua'}
  sumber text not null check (sumber in ('rapat','hr','leader','chat','owner','pm','studio_manager')),
  jalur text not null check (jalur in ('biasa','darurat','internal')),
  status text not null,
  pengusul_email text not null,
  atas_nama_owner boolean not null default false,
  berlaku_sejak timestamptz null,               -- wajib untuk jalur darurat
  diteruskan_pada timestamptz null,
  rapat_sasaran date null,
  tenggat_dampak timestamptz null,
  masa_keberatan_sampai timestamptz null,       -- jalur internal: dibuat + 27 jam kerja
  keputusan_alasan text null, diputuskan_oleh text null, diputuskan_pada timestamptz null,
  rapat_id uuid null,
  uji_coba_sampai date null,
  pengganti_id uuid null references public.mgmt_usulan(id),
  dibuat_pada timestamptz not null default now()
);
create table if not exists public.mgmt_usulan_dampak (
  usulan_id uuid not null references public.mgmt_usulan(id) on delete cascade,
  divisi text not null check (divisi in ('sosmed','service','marketplace','hr')),
  nilai text null check (nilai in ('tidak_berdampak','perlu_penyesuaian','bertentangan','tidak_mengisi')),
  alasan text null, diisi_oleh text null, diisi_pada timestamptz null,
  primary key (usulan_id, divisi)
);
create table if not exists public.mgmt_usulan_keberatan (
  id uuid primary key default gen_random_uuid(),
  usulan_id uuid not null references public.mgmt_usulan(id) on delete cascade,
  oleh text not null, alasan text not null, dibuat_pada timestamptz not null default now()
);
create table if not exists public.mgmt_pedoman_usulan (
  versi_id uuid not null references public.mgmt_pedoman_versi(id) on delete cascade,
  usulan_id uuid not null references public.mgmt_usulan(id),
  primary key (versi_id, usulan_id)
);
create table if not exists public.mgmt_pedoman_baca (
  versi_id uuid not null references public.mgmt_pedoman_versi(id) on delete cascade,
  user_id uuid not null,
  dibaca_pada timestamptz not null default now(),
  primary key (versi_id, user_id)
);
insert into public.pengaturan (kunci, nilai) values
  ('mgmt_hari_rapat','1'), ('mgmt_jam_rapat','10:00'), ('mgmt_mulai_penilaian','2027-02-01')
on conflict (kunci) do nothing;
```

**Fungsi hari kerja** (ditulis lengkap; cermin `hariKerja.ts`):

```sql
create or replace function public.mgmt_hari_kerja(p date) returns boolean
language sql stable set search_path = public as $$
  select extract(isodow from p) < 6
     and not exists (select 1 from public.hari_libur h where h.tanggal = p and h.libur = true)
$$;

create or replace function public.mgmt_tambah_jam_kerja(p_mulai timestamptz, p_jam numeric)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  sisa interval := make_interval(secs => round(p_jam * 3600));
  t timestamp := p_mulai at time zone 'Asia/Jakarta';
  d date := (p_mulai at time zone 'Asia/Jakarta')::date;
  buka timestamp; tutup timestamp; muat interval;
begin
  for i in 1..400 loop
    buka := d + time '09:00'; tutup := d + time '18:00';
    if not public.mgmt_hari_kerja(d) or t >= tutup then
      d := d + 1; t := d + time '09:00'; continue;
    end if;
    if t < buka then t := buka; end if;
    muat := tutup - t;
    if sisa <= muat then return (t + sisa) at time zone 'Asia/Jakarta'; end if;
    sisa := sisa - muat; d := d + 1; t := d + time '09:00';
  end loop;
  raise exception 'mgmt_tambah_jam_kerja: melewati 400 hari';
end $$;

create or replace function public.mgmt_hari_kerja_sebelum(p date) returns date
language plpgsql stable set search_path = public as $$
declare d date := p - 1;
begin
  for i in 1..400 loop exit when public.mgmt_hari_kerja(d); d := d - 1; end loop;
  return d;
end $$;

create or replace function public.mgmt_rapat_berikutnya(p_dari date) returns date
language plpgsql stable set search_path = public as $$
declare
  hr int := coalesce((select nilai::int from public.pengaturan where kunci = 'mgmt_hari_rapat'), 1);
  d date := p_dari - 7; r date;
begin
  while extract(isodow from d) <> hr loop d := d + 1; end loop;
  for k in 1..60 loop
    r := d;
    for i in 1..30 loop exit when public.mgmt_hari_kerja(r); r := r + 1; end loop;
    if r >= p_dari then return r; end if;
    d := d + 7;
  end loop;
  raise exception 'mgmt_rapat_berikutnya: tidak ditemukan';
end $$;

create or replace function public.mgmt_rapat_sasaran(p_diteruskan timestamptz, out rapat date, out tenggat_dampak timestamptz)
language plpgsql stable set search_path = public as $$
declare minimal timestamptz := public.mgmt_tambah_jam_kerja(p_diteruskan, 9);
        dari date := (p_diteruskan at time zone 'Asia/Jakarta')::date;
begin
  for i in 1..60 loop
    rapat := public.mgmt_rapat_berikutnya(dari);
    tenggat_dampak := (public.mgmt_hari_kerja_sebelum(rapat) + time '18:00') at time zone 'Asia/Jakarta';
    if tenggat_dampak >= minimal then return; end if;
    dari := rapat + 1;
  end loop;
  raise exception 'mgmt_rapat_sasaran: tidak ditemukan';
end $$;
```

**Fungsi peran** (ditulis lengkap):

```sql
create or replace function public.mgmt_email_owner(p text) returns boolean
language sql immutable as $$
  -- SAMAKAN dengan src/lib/owners.ts (OWNER_EMAILS)
  select lower(trim(coalesce(p,''))) in ('dea@invisual.studio','riza@invisual.studio','tryan@invisual.studio')
$$;

create or replace function public.mgmt_peran_saya() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select a.peran as x from public.mgmt_anggota a
    where a.aktif and auth.uid() is not null and (
      a.user_id = auth.uid()
      or lower(a.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      or exists (select 1 from public.employees e where public.baris_saya(e)
                 and lower(a.email) in (lower(trim(coalesce(e.email,''))), lower(trim(coalesce(e."emailLogin",'')))))
    )
    union all
    select 'owner' where public.mgmt_email_owner(auth.jwt() ->> 'email')
  ) s
$$;

create or replace function public.adalah_management() returns boolean
language sql stable security definer set search_path = public as $$
  select cardinality(public.mgmt_peran_saya()) > 0
$$;

create or replace function public.mgmt_divisi_saya() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct d), '{}') from (
    select a.divisi as d from public.mgmt_anggota a
    where a.aktif and a.divisi is not null and a.peran like 'leader_%'
      and a.peran = any (public.mgmt_peran_saya())
      and (a.user_id = auth.uid() or lower(a.email) = lower(coalesce(auth.jwt() ->> 'email',''))
           or exists (select 1 from public.employees e where public.baris_saya(e)
                      and lower(a.email) in (lower(trim(coalesce(e.email,''))), lower(trim(coalesce(e."emailLogin",''))))))
    union all select 'hr' where 'hr' = any (public.mgmt_peran_saya())
  ) s
$$;

create or replace function public.mgmt_email_saya() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email','')) $$;
```

**RPC** (semuanya `security definer`, `set search_path = public`):
- Mengembalikan `json` berbentuk `{"ok":true, ...}`, atau melempar `raise exception '<pesan Indonesia>'`.
- Setiap RPC menulis ke `audit_log(actor, action, target, detail)` dengan `actor = mgmt_email_saya()`.

| RPC | Siapa | Efek dan validasi |
|---|---|---|
| `mgmt_atur_anggota(p_aksi text, p_id uuid, p_email text, p_nama text, p_peran text, p_divisi text) returns json` | `studio_manager`, `hr`, `owner` | Mengelola anggota. Lihat **Aturan `mgmt_atur_anggota`** di bawah tabel |
| `mgmt_atur_divisi_staf(p_id_karyawan text, p_divisi text) returns json` | `hr`, `studio_manager` | Upsert `mgmt_divisi_staf` |
| `mgmt_ajukan_usulan(p_judul text, p_masalah text, p_perubahan text, p_bagian text, p_divisi text[], p_sumber text, p_jalur text, p_berlaku_sejak timestamptz default null, p_atas_nama_owner boolean default false) returns json` | Semua anggota management | Membuat usulan baru. Lihat **Aturan `mgmt_ajukan_usulan`** di bawah tabel |
| `mgmt_teruskan_usulan(p_id uuid, p_divisi text[]) returns json` | `pm`, `studio_manager` | Status harus `diajukan`. Mengisi `diteruskan_pada = now()`, `rapat_sasaran` dan `tenggat_dampak` dari `mgmt_rapat_sasaran(now())`, serta `divisi_terdampak = p_divisi` (`'semua'` dipecah menjadi 4 divisi). Menyisipkan baris `mgmt_usulan_dampak` (nilai null) per divisi. Status menjadi `cek_dampak` |
| `mgmt_isi_dampak(p_id uuid, p_divisi text, p_nilai text, p_alasan text) returns json` | Leader yang `p_divisi = any(mgmt_divisi_saya())`; `hr` untuk divisi `'hr'` | Status harus `cek_dampak`. Alasan wajib untuk nilai `perlu_penyesuaian`/`bertentangan`. Nilai boleh diubah sampai tenggat. Bila semua baris terisi, status menjadi `siap_diputuskan` |
| `mgmt_putuskan_usulan(p_id uuid, p_keputusan text, p_alasan text, p_uji_coba_sampai date default null, p_rapat_id uuid default null, p_pengganti_id uuid default null) returns json` | `studio_manager` | Transisi harus sah. Lihat **Aturan `mgmt_putuskan_usulan`** di bawah tabel |
| `mgmt_ajukan_ulang(p_id uuid) returns json` | `pm`, `studio_manager` | Status `ditunda` menjadi `siap_diputuskan` |
| `mgmt_keberatan(p_id uuid, p_alasan text) returns json` | Anggota management yang divisinya **bukan** satu-satunya divisi usulan, atau `pm` | Status harus `masa_keberatan`. Lihat **Aturan `mgmt_keberatan`** di bawah tabel |
| `mgmt_simpan_draf(p_versi text, p_isi_md text, p_ringkasan text) returns json` | `pm`, `studio_manager` | Upsert satu-satunya baris `draf` |
| `mgmt_terbitkan_pedoman(p_berlaku_mulai date, p_usulan uuid[], p_pengesahan_awal boolean default false) returns json` | `pm`, `studio_manager` | Lihat **Aturan `mgmt_terbitkan_pedoman`** di bawah tabel |

**Aturan `mgmt_atur_anggota`**
- Nilai `p_aksi`: `'tambah'`, `'nonaktifkan'`, atau `'aktifkan'`.
- Peran leader wajib punya divisi yang cocok:

  | Peran | Divisi wajib |
  |---|---|
  | `leader_sosmed` | `sosmed` |
  | `leader_service` | `service` |
  | `leader_marketplace` | `marketplace` |

- Tidak boleh menonaktifkan `studio_manager` aktif terakhir.

**Aturan `mgmt_ajukan_usulan`**
- Judul, masalah, perubahan, dan bagian wajib diisi.
- Aturan per jalur:

  | Jalur | Syarat | Status awal |
  |---|---|---|
  | `darurat` | Hanya `studio_manager`. `p_berlaku_sejak` wajib, tidak di masa depan, dan tidak lebih dari 7 hari ke belakang | `berlaku_darurat` |
  | `internal` | Hanya leader, dan `p_divisi = {divisi_saya}` | `masa_keberatan`, dengan `masa_keberatan_sampai = mgmt_tambah_jam_kerja(now(), 27)` |
  | `biasa` | — | `diajukan` |

- `p_atas_nama_owner` hanya boleh dipakai `studio_manager`, dan memaksa `sumber = 'owner'`.
- Nomor `U-<tahun WIB>-<urut 3 digit>` diambil di bawah `pg_advisory_xact_lock(hashtext('mgmt_usulan_nomor'))`.
- Mengembalikan `{ok, id, nomor, status}`.

**Aturan `mgmt_putuskan_usulan`**
- Transisi yang sah:

  | Dari | Keputusan yang boleh |
  |---|---|
  | `siap_diputuskan` | `disetujui`, `uji_coba`, `ditolak`, `ditunda` |
  | `berlaku_darurat` | `disetujui`, `ditolak` |
  | `uji_coba` (setelah `uji_coba_sampai ≤ hari ini WIB`) | `berlaku`, `dicabut`, `diganti` (wajib `p_pengganti_id`) |

- Alasan wajib diisi.
- Untuk `uji_coba`, tanggal akhir wajib berada 14–28 hari dari hari ini.
- Mengisi `diputuskan_*` dan `rapat_id`.

**Aturan `mgmt_keberatan`**
- Menyisipkan baris keberatan.
- Mengubah `jalur = 'biasa'` dan `status = 'diajukan'`.
- Langsung menjalankan logika teruskan dengan `divisi_terdampak ∪ {divisi pengaju keberatan}`, sehingga status berakhir di `cek_dampak`.

**Aturan `mgmt_terbitkan_pedoman`**
- Harus ada baris `draf`.
- `p_pengesahan_awal = true` hanya boleh oleh `studio_manager`, dan hanya bila belum ada versi `berlaku`/`arsip`. Selain itu `p_usulan` minimal 1, dan setiap usulan berstatus `disetujui`, `uji_coba`, `berlaku_darurat`, `gugur`, `dicabut`, atau `ditolak`.
- `ringkasan_perubahan` tidak boleh kosong.
- Efek penerbitan:
  - versi `berlaku` lama menjadi `arsip`;
  - draf menjadi `berlaku` dengan `berlaku_mulai`, `diterbitkan_*`, dan `pengesahan_awal`;
  - tautan dimasukkan ke `mgmt_pedoman_usulan`;
  - usulan berstatus `disetujui` menjadi `berlaku`.

**Fungsi batas gugur:** `mgmt_batas_gugur(p_berlaku_sejak timestamptz) returns timestamptz`
- `x = mgmt_tambah_jam_kerja(p_berlaku_sejak, 9)`.
- `d` = tanggal WIB dari `x`. Bila jam WIB `x` lebih dari `pengaturan.mgmt_jam_rapat` (bawaan `10:00`), maka `d = d + 1`. Tujuannya agar rapat yang sudah lewat jamnya tidak dihitung.
- Hasilnya: `(mgmt_rapat_berikutnya(d) + time '23:59') at time zone 'Asia/Jakarta'`.
- UI memakai RPC ini untuk menampilkan "Gugur otomatis pada …".

**Fungsi cron** (idempoten; masing-masing mengembalikan jumlah baris yang diubah):
- Setiap fungsi menerima `p_sekarang timestamptz default now()`, supaya uji bisa memakai jam palsu.

| Fungsi | Efek |
|---|---|
| `mgmt_tandai_dampak_tidak_mengisi(p_sekarang)` | Untuk usulan `cek_dampak` dengan `tenggat_dampak < p_sekarang`: nilai null menjadi `'tidak_mengisi'`, lalu status menjadi `siap_diputuskan` |
| `mgmt_tutup_masa_keberatan(p_sekarang)` | `masa_keberatan` dengan `masa_keberatan_sampai < p_sekarang` menjadi `berlaku` |
| `mgmt_gugurkan_darurat(p_sekarang)` | `berlaku_darurat` menjadi `gugur` bila `p_sekarang > mgmt_batas_gugur(berlaku_sejak)` |

**Fungsi baca untuk semua karyawan:** `mgmt_aturan_internal() returns table (nomor text, judul text, divisi text[], perubahan text, berlaku_sejak timestamptz)`
- `security definer`, `grant` ke `authenticated`.
- Isinya usulan jalur `internal` berstatus `berlaku`. `berlaku_sejak` diambil dari `masa_keberatan_sampai`.
- Dipakai bagian "Aturan internal divisi" di tab Pedoman.

Jadwal: `cron.schedule('mgmt-per-jam', '5 * * * *', 'select public.mgmt_tandai_dampak_tidak_mengisi(); select public.mgmt_tutup_masa_keberatan(); select public.mgmt_gugurkan_darurat();')`. Sebelum dijadwalkan, `cron.unschedule` dulu bila job sudah ada.

**RLS**

| Tabel | Hak |
|---|---|
| Semua tabel `mgmt_*` | `enable row level security` |
| `mgmt_pedoman_versi` | Select bila `status in ('berlaku','arsip')` untuk `authenticated`; status `draf` hanya `adalah_management()` |
| `mgmt_pedoman_baca` | Insert/select milik sendiri (`user_id = auth.uid()`). Select semua untuk `pm`/`hr`/`studio_manager`/`owner`. Leader hanya baris karyawan di divisinya (join `employees.user_id` ke `mgmt_divisi_staf`) |
| `mgmt_divisi_staf` | Select untuk `adalah_management()` |
| `mgmt_anggota`, `mgmt_usulan*`, `mgmt_pedoman_usulan` | Select untuk `adalah_management()` |

- **Tidak ada** policy insert/update/delete langsung, kecuali `mgmt_pedoman_baca` (insert milik sendiri). Semua penulisan lewat RPC.
- `grant execute` pada fungsi-fungsi di atas `to authenticated`.
- Pagar `pagar_akses_login` dipasang di setiap tabel `mgmt_*`, dengan definisi sama seperti `akses-login.sql`: `as restrictive for all to authenticated using ((select public.akses_terbuka())) with check ((select public.akses_terbuka()))`. Gunakan `drop policy if exists` dulu.

**Bagian darurat** (komentar di akhir berkas):
- `select cron.unschedule('mgmt-per-jam');`
- `revoke execute on function public.mgmt_peran_saya() from authenticated;` Ini membuat menu tersembunyi, karena RPC gagal dan klien menganggap fitur belum ada.

**Langkah:**
- [ ] **Stub.** Tulis `stub-mgmt.sql`, berisi:
  - stub yang sama seperti uji akses-login: `auth.uid()`/`auth.jwt()` dari `set local request.jwt.claims`, `employees`, `members`, `audit_log`, `pengaturan`, `hari_libur(tanggal date, nama text, jenis text, libur boolean)`, `akses_terbuka()`, `baris_saya(e employees)`;
  - skema `cron` tiruan;
  - akun uji untuk tiap peran, ditambah satu karyawan biasa dan satu owner `dea@invisual.studio`;
  - `hari_libur` 2026-12-25 dengan `libur = true`.
- [ ] **Uji (harus gagal sebelum SQL ada).** Tulis `uji-mgmt-p1.sh`. Setiap baris berikut menjadi satu `psql -v ON_ERROR_STOP=1` yang membandingkan hasil dengan nilai harapan:
  - **Pemasangan:** dijalankan 2× tanpa galat; job `mgmt-per-jam` tepat 1; 3 kunci `pengaturan` ada.
  - **`mgmt_tambah_jam_kerja`:**

    | Mulai (WIB) | Jam | Hasil (WIB) |
    |---|---|---|
    | Sen 30 Nov 2026 09:00 | 9 | Sen 18:00 |
    | Sen 30 Nov 10:00 | 9 | Sel 1 Des 10:00 |
    | Jum 27 Nov 13:00 | 9 | Sen 30 Nov 13:00 |
    | Sab 28 Nov 08:00 | 1 | Sen 30 Nov 10:00 |
    | Kam 24 Des 15:00 | 9 | Sen 28 Des 15:00 (25 Des libur) |

  - **`mgmt_rapat_sasaran`:**

    | Diteruskan (WIB) | Rapat | Tenggat dampak (WIB) |
    |---|---|---|
    | Sel 24 Nov 10:00 | 2026-11-30 | Jum 27 Nov 18:00 |
    | Jum 27 Nov 13:00 | 2026-12-07 | Jum 4 Des 18:00 |
    | Rab 23 Des 10:00 | 2026-12-28 | Kam 24 Des 18:00 |

  - **Peran:**
    - `mgmt_peran_saya()` untuk karyawan biasa bernilai `{}`.
    - Untuk `dea@invisual.studio` berisi `owner` walau tanpa baris.
    - Leader yang cocok lewat `employees.emailLogin` mendapat perannya.
  - **RLS:**
    - Karyawan biasa membaca versi `berlaku`, tetapi 0 baris `draf`, 0 `mgmt_usulan`, dan 0 `mgmt_anggota`.
    - Karyawan biasa bisa insert `mgmt_pedoman_baca` miliknya sendiri, dan ditolak untuk `user_id` orang lain.
  - **Pedoman:**
    - Terbitkan v1.0 dengan `pengesahan_awal` oleh SM berhasil.
    - Oleh PM ditolak ("Pengesahan awal hanya oleh Studio Manager").
    - Terbitkan v1.1 tanpa usulan ditolak.
    - Dengan usulan `disetujui`: v1.0 menjadi `arsip`, v1.1 menjadi `berlaku`, dan usulan menjadi `berlaku`.
  - **Jalur biasa:**
    - Ajukan → teruskan (`rapat_sasaran` dan `tenggat_dampak` terisi, baris dampak dibuat) → leader sosmed mengisi divisi `service`, ditolak → semua terisi → `siap_diputuskan` → SM `ditunda` → ajukan ulang → `uji_coba` dengan tanggal 10 hari, ditolak; dengan 21 hari, berhasil.
    - PM memutuskan → ditolak.
  - **Jalur darurat:**
    - Oleh PM ditolak.
    - Oleh SM: `berlaku_sejak` 2 hari lalu → `berlaku_darurat`.
    - `mgmt_batas_gugur`:

      | Berlaku sejak (WIB) | Batas gugur (WIB) |
      |---|---|
      | Sen 30 Nov 2026 09:00 | Sen 7 Des 23:59 |
      | Kam 26 Nov 09:00 | Sen 30 Nov 23:59 |
      | Jum 27 Nov 14:00 | Sen 7 Des 23:59 |

    - `mgmt_gugurkan_darurat(<batas + 1 menit>)` → `gugur`. Dijalankan lagi → 0 perubahan.
    - `mgmt_aturan_internal()` bisa dipanggil karyawan biasa dan hanya mengembalikan jalur internal yang `berlaku`.
  - **Jalur internal:**
    - Leader marketplace membuat untuk divisi `marketplace` → `masa_keberatan`.
    - Untuk divisi lain → ditolak.
    - Keberatan oleh leader sosmed → `cek_dampak` dengan divisi `{marketplace, sosmed}`.
    - Tanpa keberatan, setelah tenggat → `mgmt_tutup_masa_keberatan()` → `berlaku`.
  - **Tidak mengisi:** `tenggat_dampak` lewat → `mgmt_tandai_dampak_tidak_mengisi()` → nilai `tidak_mengisi` dan status `siap_diputuskan`.
  - **Nomor:** dua usulan berurutan bernomor `U-2026-001` dan `U-2026-002`.
  - **Audit:** setiap RPC sukses menambah 1 baris `audit_log`.
  - **Transaksi:** galat di tengah berkas → seluruh transaksi batal (tabel tidak ada).
- [ ] Jalankan `bash $S/pgtes/uji-mgmt-p1.sh`. Harapan: GAGAL karena `management-p1.sql` belum ada.
- [ ] Tulis `management-p1.sql` (DDL dan fungsi di atas, RPC sesuai kontrak) sampai semua cek lulus.
- [ ] Jalankan uji 2× berturut-turut. Harapan: semua `OK`.

### Task 2: `src/lib/management/hariKerja.ts` + unit test

**Files:**
- Create: `src/lib/management/hariKerja.ts`
- Test: `$S/unit/hariKerja.test.ts`

**Interfaces:**
- Consumes: `type PetaLibur` dari `src/lib/hariLibur.ts`, berupa `Map<string, HariLibur>` dengan `libur: boolean`.
- Produces:
  - `JAM_MULAI = 9`, `JAM_SELESAI = 18`, `JAM_PER_HARI = 9`;
  - `isoWib(d: Date): string`;
  - `instanWib(iso: string, jam: number, menit?: number): Date`;
  - `tambahHariIso(iso: string, n: number): string`;
  - `adalahHariKerja(iso: string, peta?: PetaLibur | null): boolean`;
  - `tambahJamKerja(mulai: Date, jam: number, peta?: PetaLibur | null): Date`;
  - `hariKerjaSebelum(iso: string, peta?: PetaLibur | null): string`;
  - `rapatBerikutnya(dariIso: string, hariRapat: number, peta?: PetaLibur | null): string` (hariRapat: 1 = Senin);
  - `rapatSasaran(diteruskan: Date, hariRapat: number, peta?: PetaLibur | null): { rapat: string; tenggatDampak: Date }`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// $S/unit/hariKerja.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { tambahJamKerja, rapatSasaran, hariKerjaSebelum, adalahHariKerja, instanWib, isoWib } from "../../invisual-hris/src/lib/management/hariKerja.ts";

const peta = new Map([["2026-12-25", { tanggal: "2026-12-25", nama: "Natal", jenis: "nasional", libur: true }]]) as any;
const w = (iso: string, j: number, m = 0) => instanWib(iso, j, m);
const eq = (a: Date, b: Date) => assert.equal(a.toISOString(), b.toISOString());

test("tambahJamKerja — kasus yang sama dengan uji SQL", () => {
  eq(tambahJamKerja(w("2026-11-30", 9), 9, peta), w("2026-11-30", 18));
  eq(tambahJamKerja(w("2026-11-30", 10), 9, peta), w("2026-12-01", 10));
  eq(tambahJamKerja(w("2026-11-27", 13), 9, peta), w("2026-11-30", 13));
  eq(tambahJamKerja(w("2026-11-28", 8), 1, peta), w("2026-11-30", 10));
  eq(tambahJamKerja(w("2026-12-24", 15), 9, peta), w("2026-12-28", 15));
});

test("rapatSasaran — kasus yang sama dengan uji SQL", () => {
  const a = rapatSasaran(w("2026-11-24", 10), 1, peta); assert.equal(a.rapat, "2026-11-30"); eq(a.tenggatDampak, w("2026-11-27", 18));
  const b = rapatSasaran(w("2026-11-27", 13), 1, peta); assert.equal(b.rapat, "2026-12-07"); eq(b.tenggatDampak, w("2026-12-04", 18));
  const c = rapatSasaran(w("2026-12-23", 10), 1, peta); assert.equal(c.rapat, "2026-12-28"); eq(c.tenggatDampak, w("2026-12-24", 18));
});

test("batas WIB & hari kerja", () => {
  assert.equal(isoWib(new Date("2026-11-30T17:30:00Z")), "2026-12-01"); // 00:30 WIB
  assert.equal(adalahHariKerja("2026-12-25", peta), false);
  assert.equal(adalahHariKerja("2026-12-26", peta), false);
  assert.equal(hariKerjaSebelum("2026-12-28", peta), "2026-12-24");
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --experimental-strip-types --test $S/unit/hariKerja.test.ts`
Expected: FAIL (`Cannot find module .../hariKerja.ts`)

- [ ] **Step 3: Implementasi**

```ts
// src/lib/management/hariKerja.ts
// Hari & jam kerja Section Management — CERMIN fungsi SQL mgmt_* di management-p1.sql.
// Hari kerja: Senin–Jumat, 09.00–18.00 WIB, bukan hari_libur.libur = true. 1 hari kerja = 9 jam kerja.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
import type { PetaLibur } from "../hariLibur";

export const JAM_MULAI = 9;
export const JAM_SELESAI = 18;
export const JAM_PER_HARI = JAM_SELESAI - JAM_MULAI;
const WIB_MS = 7 * 3_600_000;
const JAM_MS = 3_600_000;

export const isoWib = (d: Date): string => new Date(d.getTime() + WIB_MS).toISOString().slice(0, 10);
export const instanWib = (iso: string, jam: number, menit = 0): Date =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - WIB_MS + (jam * 60 + menit) * 60_000);
export const tambahHariIso = (iso: string, n: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const hariMinggu = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0=Min … 6=Sab

export function adalahHariKerja(iso: string, peta?: PetaLibur | null): boolean {
  const d = hariMinggu(iso);
  if (d === 0 || d === 6) return false;
  return peta?.get(iso)?.libur !== true;
}

export function tambahJamKerja(mulai: Date, jam: number, peta?: PetaLibur | null): Date {
  let sisa = Math.round(jam * JAM_MS);
  let iso = isoWib(mulai);
  let t = mulai.getTime();
  for (let i = 0; i < 400; i++) {
    const buka = instanWib(iso, JAM_MULAI).getTime();
    const tutup = instanWib(iso, JAM_SELESAI).getTime();
    if (!adalahHariKerja(iso, peta) || t >= tutup) { iso = tambahHariIso(iso, 1); t = instanWib(iso, JAM_MULAI).getTime(); continue; }
    if (t < buka) t = buka;
    const muat = tutup - t;
    if (sisa <= muat) return new Date(t + sisa);
    sisa -= muat;
    iso = tambahHariIso(iso, 1);
    t = instanWib(iso, JAM_MULAI).getTime();
  }
  throw new Error("tambahJamKerja: melewati 400 hari");
}

export function hariKerjaSebelum(iso: string, peta?: PetaLibur | null): string {
  let d = tambahHariIso(iso, -1);
  for (let i = 0; i < 400 && !adalahHariKerja(d, peta); i++) d = tambahHariIso(d, -1);
  return d;
}

export function rapatBerikutnya(dariIso: string, hariRapat: number, peta?: PetaLibur | null): string {
  let d = tambahHariIso(dariIso, -7);                         // rapat minggu lalu yang tergeser libur ikut diperiksa
  while (hariMinggu(d) !== hariRapat % 7) d = tambahHariIso(d, 1);
  for (let k = 0; k < 60; k++, d = tambahHariIso(d, 7)) {
    let r = d;
    for (let i = 0; i < 30 && !adalahHariKerja(r, peta); i++) r = tambahHariIso(r, 1);
    if (r >= dariIso) return r;
  }
  throw new Error("rapatBerikutnya: tidak ditemukan");
}

export function rapatSasaran(diteruskan: Date, hariRapat: number, peta?: PetaLibur | null): { rapat: string; tenggatDampak: Date } {
  const minimal = tambahJamKerja(diteruskan, JAM_PER_HARI, peta).getTime();
  let dari = isoWib(diteruskan);
  for (let i = 0; i < 60; i++) {
    const rapat = rapatBerikutnya(dari, hariRapat, peta);
    const tenggatDampak = instanWib(hariKerjaSebelum(rapat, peta), JAM_SELESAI);
    if (tenggatDampak.getTime() >= minimal) return { rapat, tenggatDampak };
    dari = tambahHariIso(rapat, 1);
  }
  throw new Error("rapatSasaran: tidak ditemukan");
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node --experimental-strip-types --test $S/unit/hariKerja.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/management/hariKerja.ts
git commit -m "feat(management): hari & jam kerja (cermin SQL)"
```

### Task 3: `akses.ts` + `usulan.ts` (aturan murni + pemanggil RPC)

**Files:**
- Create: `src/lib/management/akses.ts`
- Create: `src/lib/management/usulan.ts`
- Test: `$S/unit/akses.test.ts`
- Test: `$S/unit/usulan.test.ts`

**Interfaces — Produces:**

```ts
// akses.ts
export type PeranManagement = "studio_manager" | "pm" | "hr" | "leader_sosmed" | "leader_service" | "leader_marketplace" | "owner";
export type Divisi = "sosmed" | "service" | "marketplace";
export type AksiManagement =
  | "terbitkan_pedoman" | "lihat_status_baca_semua" | "ajukan_usulan" | "teruskan_usulan" | "isi_dampak"
  | "putuskan_usulan" | "atas_nama_owner" | "kelola_anggota" | "atur_divisi_staf"
  | "serah_terima" | "tindaklanjuti" | "ringkasan_harian";
export const PERAN_LABEL: Record<PeranManagement, string>;     // "Studio Manager", "PM", "HR", "Leader Sosmed", "Leader Service", "Leader Marketplace", "Owner"
export function bisa(peran: readonly PeranManagement[], aksi: AksiManagement): boolean;
export const adalahLeader = (p: readonly PeranManagement[]) => boolean;
export async function muatPeranSaya(sb: any): Promise<PeranManagement[] | null>; // null = RPC belum ada / galat
export async function muatDivisiSaya(sb: any): Promise<string[]>;

// usulan.ts
export type StatusUsulan = "diajukan" | "cek_dampak" | "siap_diputuskan" | "disetujui" | "uji_coba" | "ditolak" | "ditunda"
  | "berlaku" | "dicabut" | "diganti" | "berlaku_darurat" | "gugur" | "masa_keberatan";
export type JalurUsulan = "biasa" | "darurat" | "internal";
export const TRANSISI: Record<StatusUsulan, StatusUsulan[]>;
export const STATUS_AWAL: Record<JalurUsulan, StatusUsulan>;
export const LABEL_STATUS: Record<StatusUsulan, string>;
export const STATUS_BOLEH_TAUT: StatusUsulan[];       // untuk menerbitkan Pedoman
export function transisiSah(dari: StatusUsulan, ke: StatusUsulan): boolean;
export function sudahDiputuskan(s: StatusUsulan): boolean;
export function formatNomorUsulan(tahun: number, urut: number): string;
export function umurMerah(dibuatPada: string, status: StatusUsulan, sekarang: Date): boolean;   // > 7 hari & belum diputuskan
export type HasilRpc<T = unknown> = { ok: boolean; pesan?: string; data?: T };
export async function ajukanUsulan(sb: any, d: { judul: string; masalah: string; perubahan: string; bagian: string; divisi: string[]; sumber: string; jalur: JalurUsulan; berlakuSejak?: string | null; atasNamaOwner?: boolean }): Promise<HasilRpc<{ id: string; nomor: string; status: StatusUsulan }>>;
export async function teruskanUsulan(sb: any, id: string, divisi: string[]): Promise<HasilRpc>;
export async function isiDampak(sb: any, id: string, divisi: string, nilai: string, alasan: string): Promise<HasilRpc>;
export async function putuskanUsulan(sb: any, id: string, keputusan: StatusUsulan, alasan: string, opsi?: { ujiCobaSampai?: string; rapatId?: string; penggantiId?: string }): Promise<HasilRpc>;
export async function ajukanUlang(sb: any, id: string): Promise<HasilRpc>;
export async function ajukanKeberatan(sb: any, id: string, alasan: string): Promise<HasilRpc>;
export async function muatUsulan(sb: any): Promise<any[] | null>;            // urut dibuat_pada desc; null = tabel belum ada
```

Matriks `bisa()` (sumber: PRD, "Hak per peran"):

| Aksi | Peran yang boleh |
|---|---|
| `terbitkan_pedoman` | `studio_manager`, `pm` |
| `lihat_status_baca_semua` | `studio_manager`, `pm`, `hr`, `owner` |
| `ajukan_usulan` | Semua peran |
| `teruskan_usulan` | `studio_manager`, `pm` |
| `isi_dampak` | `hr` + leader |
| `putuskan_usulan` | `studio_manager` |
| `atas_nama_owner` | `studio_manager` |
| `kelola_anggota` | `studio_manager`, `hr`, `owner` |
| `atur_divisi_staf` | `studio_manager`, `hr` |
| `serah_terima` | `studio_manager`, `pm`, leader, `owner` |
| `tindaklanjuti` | `studio_manager`, `pm` |
| `ringkasan_harian` | Leader |

Pemanggil RPC:
- Memetakan `error.message` ke `pesan`.
- Galat `function ... does not exist` / kode `PGRST202` menjadi `{ok:false, pesan:"Fitur Management belum dipasang."}`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// $S/unit/usulan.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { transisiSah, STATUS_AWAL, formatNomorUsulan, umurMerah, sudahDiputuskan } from "../../invisual-hris/src/lib/management/usulan.ts";
import { bisa } from "../../invisual-hris/src/lib/management/akses.ts";

test("transisi sama dengan SQL", () => {
  assert.equal(transisiSah("diajukan", "cek_dampak"), true);
  assert.equal(transisiSah("diajukan", "disetujui"), false);
  assert.equal(transisiSah("siap_diputuskan", "uji_coba"), true);
  assert.equal(transisiSah("berlaku_darurat", "uji_coba"), false);
  assert.equal(transisiSah("berlaku_darurat", "gugur"), true);
  assert.equal(transisiSah("masa_keberatan", "cek_dampak"), true);
  assert.equal(transisiSah("uji_coba", "diganti"), true);
  assert.equal(transisiSah("berlaku", "dicabut"), false);
  assert.deepEqual(STATUS_AWAL, { biasa: "diajukan", darurat: "berlaku_darurat", internal: "masa_keberatan" });
});

test("nomor & umur", () => {
  assert.equal(formatNomorUsulan(2026, 7), "U-2026-007");
  const now = new Date("2026-12-10T03:00:00Z");
  assert.equal(umurMerah("2026-12-02T02:00:00Z", "cek_dampak", now), true);
  assert.equal(umurMerah("2026-12-02T02:00:00Z", "ditolak", now), false);
  assert.equal(umurMerah("2026-12-05T02:00:00Z", "diajukan", now), false);
  assert.equal(sudahDiputuskan("ditunda"), false);
});

test("matriks hak", () => {
  assert.equal(bisa(["pm"], "putuskan_usulan"), false);
  assert.equal(bisa(["studio_manager"], "putuskan_usulan"), true);
  assert.equal(bisa(["leader_service"], "isi_dampak"), true);
  assert.equal(bisa(["owner"], "ajukan_usulan"), true);
  assert.equal(bisa(["owner"], "terbitkan_pedoman"), false);
  assert.equal(bisa(["hr"], "kelola_anggota"), true);
  assert.equal(bisa([], "ajukan_usulan"), false);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --experimental-strip-types --test $S/unit/usulan.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implementasi bagian murni**

```ts
// src/lib/management/usulan.ts (bagian murni; pemanggil RPC di bawahnya mengikuti antarmuka di atas)
export const TRANSISI: Record<StatusUsulan, StatusUsulan[]> = {
  diajukan: ["cek_dampak"],
  cek_dampak: ["siap_diputuskan"],
  siap_diputuskan: ["disetujui", "uji_coba", "ditolak", "ditunda"],
  ditunda: ["siap_diputuskan"],
  disetujui: ["berlaku"],
  uji_coba: ["berlaku", "dicabut", "diganti"],
  berlaku_darurat: ["disetujui", "ditolak", "gugur"],
  masa_keberatan: ["berlaku", "cek_dampak"],
  berlaku: [], ditolak: [], dicabut: [], diganti: [], gugur: [],
};
export const STATUS_AWAL: Record<JalurUsulan, StatusUsulan> = { biasa: "diajukan", darurat: "berlaku_darurat", internal: "masa_keberatan" };
export const LABEL_STATUS: Record<StatusUsulan, string> = {
  diajukan: "Diajukan", cek_dampak: "Cek dampak", siap_diputuskan: "Siap diputuskan", disetujui: "Disetujui",
  uji_coba: "Uji coba", ditolak: "Ditolak", ditunda: "Ditunda", berlaku: "Berlaku", dicabut: "Dicabut",
  diganti: "Diganti", berlaku_darurat: "Berlaku (darurat)", gugur: "Gugur", masa_keberatan: "Masa keberatan",
};
export const STATUS_BOLEH_TAUT: StatusUsulan[] = ["disetujui", "uji_coba", "berlaku_darurat", "gugur", "dicabut", "ditolak"];
const BELUM: StatusUsulan[] = ["diajukan", "cek_dampak", "siap_diputuskan", "ditunda", "berlaku_darurat", "masa_keberatan"];
export const transisiSah = (dari: StatusUsulan, ke: StatusUsulan) => (TRANSISI[dari] || []).includes(ke);
export const sudahDiputuskan = (s: StatusUsulan) => !BELUM.includes(s);
export const formatNomorUsulan = (tahun: number, urut: number) => `U-${tahun}-${String(urut).padStart(3, "0")}`;
export const umurMerah = (dibuatPada: string, status: StatusUsulan, sekarang: Date) =>
  !sudahDiputuskan(status) && sekarang.getTime() - Date.parse(dibuatPada) > 7 * 86_400_000;
```

```ts
// src/lib/management/akses.ts (bagian murni)
const SEMUA: PeranManagement[] = ["studio_manager", "pm", "hr", "leader_sosmed", "leader_service", "leader_marketplace", "owner"];
const LEADER: PeranManagement[] = ["leader_sosmed", "leader_service", "leader_marketplace"];
const HAK: Record<AksiManagement, PeranManagement[]> = {
  terbitkan_pedoman: ["studio_manager", "pm"],
  lihat_status_baca_semua: ["studio_manager", "pm", "hr", "owner"],
  ajukan_usulan: SEMUA,
  teruskan_usulan: ["studio_manager", "pm"],
  isi_dampak: ["hr", ...LEADER],
  putuskan_usulan: ["studio_manager"],
  atas_nama_owner: ["studio_manager"],
  kelola_anggota: ["studio_manager", "hr", "owner"],
  atur_divisi_staf: ["studio_manager", "hr"],
  serah_terima: ["studio_manager", "pm", ...LEADER, "owner"],
  tindaklanjuti: ["studio_manager", "pm"],
  ringkasan_harian: LEADER,
};
export const bisa = (peran: readonly PeranManagement[], aksi: AksiManagement) => peran.some((p) => HAK[aksi].includes(p));
export const adalahLeader = (p: readonly PeranManagement[]) => p.some((x) => LEADER.includes(x));
```

- [ ] **Step 4: Tulis pemanggil RPC** (`muatPeranSaya` lewat `sb.rpc("mgmt_peran_saya")`, dan seterusnya) sesuai antarmuka. Lalu jalankan test.

Run: `node --experimental-strip-types --test $S/unit/usulan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/management/akses.ts src/lib/management/usulan.ts
git commit -m "feat(management): matriks hak, status & transisi usulan"
```

### Task 4: `pedoman.ts` + `pedomanRender.ts` (daftar isi, diff, render aman)

**Files:**
- Create: `src/lib/management/pedoman.ts`
- Create: `src/lib/management/pedomanRender.ts`
- Modify: `package.json` (dependencies `"marked": "^15.0.0"`), lalu `npm install`
- Test: `$S/unit/pedoman.test.ts`

**Interfaces — Produces:**

```ts
// pedoman.ts (murni + pemanggil data)
export type Judul = { id: string; teks: string; level: 2 | 3 };
export function slug(s: string): string;
export function daftarIsi(md: string): Judul[];            // abaikan baris di dalam pagar kode (3 backtick); id unik: "x", "x-2", …
export function bagianPedoman(md: string): string[];       // teks semua judul level 2 (untuk isian "Bagian Pedoman")
export type BarisDiff = { jenis: "sama" | "tambah" | "hapus"; teks: string };
export function diffBaris(lama: string, baru: string): BarisDiff[];   // LCS per baris
export type VersiPedoman = { id: string; versi: string; isi_md: string; ringkasan_perubahan: string; status: "draf" | "berlaku" | "arsip"; berlaku_mulai: string | null; diterbitkan_pada: string | null };
export async function muatVersi(sb: any): Promise<VersiPedoman[] | null>;      // null = tabel belum ada
export async function sudahBaca(sb: any, versiId: string, userId: string): Promise<boolean>;
export async function konfirmasiBaca(sb: any, versiId: string, userId: string): Promise<HasilRpc>;
export async function simpanDraf(sb: any, versi: string, isiMd: string, ringkasan: string): Promise<HasilRpc>;
export async function terbitkanPedoman(sb: any, berlakuMulai: string, usulan: string[], pengesahanAwal?: boolean): Promise<HasilRpc>;
// Consumes: `import type { HasilRpc } from "./usulan.ts"` (Task 3)
// pedomanRender.ts (peramban saja)
export function renderPedoman(md: string): string;         // marked → heading diberi id = daftarIsi() → DOMPurify
```

Konfigurasi DOMPurify di `renderPedoman`:
- `ALLOWED_TAGS`: `p`, `br`, `h1`–`h4`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `pre`, `blockquote`, `hr`, `a`, `table`, `thead`, `tbody`, `tr`, `th`, `td`.
- `ALLOWED_ATTR`: `href`, `id`, `title`.
- `ALLOWED_URI_REGEXP`: `/^(?:https?:|mailto:|#|\/(?!\/))/i`.
- **Jangan** memakai `sanitasiHtmlDokumen`, karena fungsi itu membuang `id` dan tabel.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// $S/unit/pedoman.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { daftarIsi, bagianPedoman, diffBaris, slug } from "../../invisual-hris/src/lib/management/pedoman.ts";

const pagar = "`".repeat(3);   // pagar blok kode Markdown (ditulis begini agar tidak memutus blok kode dokumen ini)
const md = `# Judul\n\n## Bagian 1 — Peran\n### SOP PM\n${pagar}\n## bukan judul\n${pagar}\n## Bagian 2 — Jalur\n## Bagian 2 — Jalur\n`;
test("daftar isi & bagian", () => {
  assert.equal(slug("Bagian 1 — Peran & Hak"), "bagian-1-peran-hak");
  assert.deepEqual(daftarIsi(md).map((j) => [j.level, j.id]), [[2, "bagian-1-peran"], [3, "sop-pm"], [2, "bagian-2-jalur"], [2, "bagian-2-jalur-2"]]);
  assert.deepEqual(bagianPedoman(md), ["Bagian 1 — Peran", "Bagian 2 — Jalur", "Bagian 2 — Jalur"]);
});
test("diff baris", () => {
  assert.deepEqual(diffBaris("a\nb\nc", "a\nx\nc"), [
    { jenis: "sama", teks: "a" }, { jenis: "hapus", teks: "b" }, { jenis: "tambah", teks: "x" }, { jenis: "sama", teks: "c" },
  ]);
  assert.deepEqual(diffBaris("", "a"), [{ jenis: "hapus", teks: "" }, { jenis: "tambah", teks: "a" }]);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --experimental-strip-types --test $S/unit/pedoman.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasi bagian murni**

```ts
// src/lib/management/pedoman.ts (bagian murni)
export const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function daftarIsi(md: string): Judul[] {
  const hasil: Judul[] = [];
  const dipakai = new Map<string, number>();
  let dalamKode = false;
  for (const baris of md.split("\n")) {
    if (/^\s*`{3}/.test(baris)) { dalamKode = !dalamKode; continue; }
    if (dalamKode) continue;
    const m = /^(##|###)\s+(.+?)\s*#*\s*$/.exec(baris);
    if (!m) continue;
    const dasar = slug(m[2]) || "bagian";
    const n = (dipakai.get(dasar) || 0) + 1;
    dipakai.set(dasar, n);
    hasil.push({ id: n === 1 ? dasar : `${dasar}-${n}`, teks: m[2], level: m[1].length as 2 | 3 });
  }
  return hasil;
}

export const bagianPedoman = (md: string) => daftarIsi(md).filter((j) => j.level === 2).map((j) => j.teks);

export function diffBaris(lama: string, baru: string): BarisDiff[] {
  const a = lama.split("\n"), b = baru.split("\n");
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: BarisDiff[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ jenis: "sama", teks: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ jenis: "hapus", teks: a[i] }); i++; }
    else { out.push({ jenis: "tambah", teks: b[j] }); j++; }
  }
  while (i < n) out.push({ jenis: "hapus", teks: a[i++] });
  while (j < m) out.push({ jenis: "tambah", teks: b[j++] });
  return out;
}
```

- [ ] **Step 4: Tulis `pedomanRender.ts` dan pemanggil data, lalu jalankan test**

`pedomanRender.ts` memakai `marked` dengan `renderer.heading`. Id heading level 2–3 diambil berurutan dari `daftarIsi(md)` supaya sama persis dengan daftar isi. Hasilnya lalu disaring DOMPurify dengan konfigurasi di atas.

Run: `node --experimental-strip-types --test $S/unit/pedoman.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/management/pedoman.ts src/lib/management/pedomanRender.ts
git commit -m "feat(management): daftar isi, diff, dan render aman Pedoman"
```

### Task 5: Kerangka menu, rute, dan banner wajib baca

**Files:**
- Create: `src/components/management/Management.tsx`
- Create: `src/components/management/BannerPedoman.tsx`
- Create: `src/app/admin/management/page.tsx`
- Create: `src/app/user/management/page.tsx`
- Create: `src/app/user/pedoman/page.tsx`
- Modify: `src/app/admin/layout.tsx`. Tambah item nav `{ name: "Management", short: "Mgmt", href: "/admin/management" }` ke grup "Kolaborasi" (`GRUP_SIDEBAR`). Item ini tampil hanya bila `peran` tidak null dan tidak kosong. Pasang `<BannerPedoman portal="admin" />` di atas `{children}`.
- Modify: `src/app/user/layout.tsx`. Tambah item nav `Management` (`/user/management`) bila `peran.length > 0`. Selain itu tambah `Pedoman` (`/user/pedoman`) bila ada versi `berlaku`. Pasang `<BannerPedoman portal="user" />` di atas `{children}`.

**Interfaces:**
- Consumes:
  - `muatPeranSaya`, `bisa`, `PERAN_LABEL` (Task 3);
  - `muatVersi`, `sudahBaca` (Task 4).
- Produces:
  - `Management({ portal }: { portal: "admin" | "user" })`. Tab dikendalikan `?tab=` dengan nilai `ringkasan`, `pedoman`, `usulan`, `serah-terima`, `harian`, `anggota`. Tab P2 tersembunyi bila tabelnya belum ada.
  - Di ponsel, baris tab menjadi gulir horizontal (`overflow-x-auto`, tanpa wrap).
  - `BannerPedoman({ portal })`. Banner tampil bila ada versi `berlaku` yang belum dikonfirmasi pengguna. Teksnya: "Pedoman {versi} berlaku mulai {teksTanggalISO(berlaku_mulai)} — Baca & konfirmasi". Tautannya: `/admin/management?tab=pedoman` (admin), `/user/management?tab=pedoman` (anggota management), atau `/user/pedoman` (karyawan lain). Banner tidak menutupi tombol Clock In; tempatnya di aliran halaman, bukan overlay.

Langkah:
- [ ] Tulis skenario e2e dulu di `$S/e2e/management.js` (mock Supabase seperti `$S/e2e/mock.js`). Skenario berikut harus gagal:
  - RPC `mgmt_peran_saya` tidak ada → tidak ada menu Management, tidak ada banner, dan halaman lain identik;
  - peran `["pm"]` → menu Management tampil di `/user`;
  - peran `[]` dengan versi `berlaku` → menu "Pedoman" dan banner tampil;
  - konfirmasi sudah ada → banner hilang;
  - owner di `/admin` → menu tampil di grup Kolaborasi dan di "Lainnya" ponsel.
- [ ] Implementasikan sampai skenario lulus.
- [ ] Jalankan `npx tsc --noEmit` dan `npm run lint`. Hasilnya harus sama dengan baseline.
- [ ] Commit: `feat(management): menu, rute, dan banner wajib baca`.

### Task 6: Tab Pedoman (baca, konfirmasi, riwayat, editor, status baca)

**Files:**
- Create: `src/components/management/TabPedoman.tsx`
- Create: `src/components/management/RiwayatPedoman.tsx`
- Create: `src/components/management/EditorPedoman.tsx`
- Create: `src/components/management/StatusBaca.tsx`
- Modify: `src/app/user/pedoman/page.tsx` (memakai `TabPedoman` dengan `bacaSaja`)

**Interfaces:**
- Consumes: Task 3–5.
- Produces: `TabPedoman({ peran, bacaSaja }: { peran: PeranManagement[]; bacaSaja?: boolean })`.

**Perilaku:**
- **Tampilan baca:**
  - Daftar isi di kiri (desktop) atau dilipat di atas (ponsel).
  - Isi dirender dengan `renderPedoman`.
  - Tombol **"Saya sudah membaca {versi}"** aktif setelah sentinel di akhir isi terlihat (`IntersectionObserver`), lalu memanggil `konfirmasiBaca`.
  - Bagian **"Aturan internal divisi"** di akhir isi diambil dari RPC `mgmt_aturan_internal()`: nomor, judul, divisi, perubahan, dan tanggal berlaku. Bagian ini tidak menaikkan versi. Bila kosong: "Belum ada aturan internal divisi."
- **Riwayat:** daftar versi `arsip`/`berlaku` beserta ringkasan dan tautan usulan. Tombol "Bandingkan dengan versi sebelumnya" menampilkan `diffBaris`, dengan label "+ ditambah" dan "− dihapus" (tidak hanya warna).
- **Editor** (hanya bila `bisa(peran, "terbitkan_pedoman")`):
  - Textarea Markdown dengan pratinjau.
  - Tombol "Simpan draf" (`simpanDraf`).
  - **Dialog Terbitkan:**
    - tanggal berlaku;
    - pilih usulan dari daftar ber-status `STATUS_BOLEH_TAUT`;
    - centang "Pengesahan awal" (hanya `studio_manager`, dan hanya bila belum ada versi);
    - ringkasan perubahan wajib.
  - Galat RPC ditampilkan apa adanya.
- **Status baca** (bila `bisa(peran, "lihat_status_baca_semua")` atau leader):
  - Daftar "Belum membaca" berisi nama, divisi, dan "n hari kerja sejak terbit". Leader hanya melihat divisinya.
  - Grup "Belum dipetakan" disertai pemilih divisi (hanya untuk `bisa(peran, "atur_divisi_staf")`), memanggil RPC `mgmt_atur_divisi_staf`.

Langkah:
- [ ] Tambahkan skenario e2e (harus gagal dulu):
  - tombol konfirmasi nonaktif sebelum gulir ke akhir;
  - konfirmasi → banner hilang;
  - PM menerbitkan tanpa usulan → pesan galat RPC tampil;
  - diff menampilkan baris tambah/hapus beserta labelnya;
  - leader hanya melihat status baca divisinya;
  - `/user/pedoman` tanpa tombol editor.
- [ ] Implementasikan sampai lulus. Jalankan tsc dan lint.
- [ ] Commit: `feat(management): tab Pedoman — baca, konfirmasi, riwayat, editor, status baca`.

### Task 7: Tab Usulan (daftar, formulir, detail)

**Files:**
- Create: `src/components/management/TabUsulan.tsx`
- Create: `src/components/management/FormUsulan.tsx`
- Create: `src/components/management/DetailUsulan.tsx`

**Interfaces:**
- Consumes:
  - `usulan.ts` (Task 3);
  - `bagianPedoman`, `muatVersi` (Task 4);
  - `rapatSasaran` untuk pratinjau tenggat di dialog Teruskan (Task 2).
- Produces: `TabUsulan({ peran, divisi })`.

**Perilaku:**
- **Daftar:**
  - Kolom: nomor, judul, jalur, status (label `LABEL_STATUS`), divisi, dan umur.
  - Label **"Lewat 7 hari"** muncul bila `umurMerah`.
  - Filter: status, jalur, divisi, bulan.
  - Pesan kosong: "Belum ada usulan. — Ajukan usulan".
- **Formulir:**
  - Isian sesuai PRD. "Bagian Pedoman" berupa select dari `bagianPedoman(versi berlaku)`.
  - Pilihan jalur `darurat` hanya untuk `studio_manager`, disertai penghitung "Darurat bulan ini: n/2", dan isian "Berlaku sejak" yang wajib.
    - Di detail, usulan darurat diberi label **"Terlambat dicatat (> 24 jam)"** bila `dibuat_pada − berlaku_sejak > 24 jam`.
    - Di detail juga tampil "Gugur otomatis pada …" dari RPC `mgmt_batas_gugur`.
    - Usulan ke-3 dan seterusnya dalam sebulan diberi label "Melebihi batas — dibahas di Review Bulanan". Agenda otomatis menyusul di P3.
  - Pilihan jalur `internal` hanya untuk leader, dengan divisi terkunci ke divisinya.
  - Centang "Atas nama owner" hanya untuk `studio_manager`.
- **Detail:**
  - Linimasa status dan isi usulan.
  - Tabel cek dampak per divisi, disertai tenggat dan rapat sasaran.
  - **Aksi kontekstual:**

    | Aksi | Untuk |
    |---|---|
    | Teruskan (pilih divisi) | PM/SM |
    | Isi dampak (divisi sendiri) | Leader/HR |
    | Putuskan (keputusan, alasan, tanggal akhir uji coba 14–28 hari) | SM |
    | Ajukan ulang | PM/SM, status ditunda |
    | Keberatan | Masa keberatan |
    | Evaluasi uji coba | SM, saat tanggal akhir tiba |

  - Tombol hanya tampil bila `bisa()` dan `transisiSah()` sama-sama bernilai true.

Langkah:
- [ ] Tambahkan skenario e2e (harus gagal dulu):
  - ajukan biasa → muncul `U-2026-001` berstatus "Diajukan";
  - PM teruskan;
  - leader mengisi dampak "Bertentangan" tanpa alasan → validasi;
  - SM memutuskan uji coba dengan tanggal 10 hari → validasi klien, lalu 21 hari → berhasil;
  - PM tidak melihat tombol Putuskan;
  - jalur darurat tidak tersedia untuk PM;
  - usulan ke-3 bulan ini menampilkan "melebihi batas";
  - keberatan pada internal.
- [ ] Implementasikan sampai lulus. Jalankan tsc dan lint.
- [ ] Commit: `feat(management): tab Usulan — daftar, formulir, detail & transisi`.

### Task 8: Anggota, Ringkasan/"Perlu tindakan", glosarium, uji akhir P1, kemas

**Files:**
- Create: `src/components/management/KelolaAnggota.tsx`
- Create: `src/components/management/TabRingkasan.tsx`
- Create: `src/components/management/PerluTindakan.tsx`
- Create: `src/lib/management/perluTindakan.ts`
- Modify: `docs/glosarium-istilah.md`
- Test: `$S/unit/perluTindakan.test.ts`

**Interfaces — Produces:**

```ts
// perluTindakan.ts (murni)
export type ItemTindakan = { kunci: string; judul: string; tautan: string; tenggat?: string; mendesak: boolean };
export type DataTindakan = {
  usulan: any[];                    // baris mgmt_usulan
  dampak: any[];                    // baris mgmt_usulan_dampak
  tautanPedoman: string[];          // usulan_id yang sudah tertaut ke versi mana pun
  pedomanBelumDibaca: boolean;      // versi berlaku belum dikonfirmasi pengguna
  peta?: PetaLibur | null;          // untuk hitungan jam kerja
  // P2 (Task 12):
  serahTerima?: any[];
  ringkasanHariIni?: any[];         // semua ringkasan management hari ini
  sudahKirimRingkasan?: boolean;    // milik pengguna
  hariIniDihitung?: boolean;        // dari harian.hariDihitung
};
export function hitungPerluTindakan(d: DataTindakan, peran: PeranManagement[], divisi: string[], sekarang: Date): ItemTindakan[];
```

Aturan P1 untuk `hitungPerluTindakan`:

| Peran | Item |
|---|---|
| PM/SM | "Teruskan usulan" untuk setiap usulan `diajukan` |
| Leader/HR | "Isi cek dampak" untuk baris dampak divisinya yang nilainya null. Item `mendesak` bila tenggat < 24 jam |
| SM | "Putuskan" untuk setiap `siap_diputuskan`/`berlaku_darurat` |
| PM | "Terbitkan Pedoman" bila ada usulan `disetujui` yang lebih dari 9 jam kerja dan belum tertaut |
| Leader, HR, SM | "Pedoman yang belum Anda konfirmasi" |

Item P2 ditambahkan di Task 12.

**Perilaku tambahan:**
- **`KelolaAnggota`** (hanya `bisa(peran, "kelola_anggota")`):
  - Tabel anggota, tombol Tambah (email, nama, peran, dan divisi bila leader), serta Nonaktifkan/Aktifkan lewat `mgmt_atur_anggota`.
  - Peringatan bila sebuah peran belum punya anggota aktif.
- **Glosarium:** tambahkan baris Management, Pedoman, Usulan ("jangan pakai: Pengajuan, Request"), Cek dampak, Serah terima, Ringkasan harian, Kepatuhan jalur.

Langkah:
- [ ] Tulis unit test `perluTindakan.test.ts`, minimal satu kasus per baris aturan di atas. Pastikan gagal, implementasikan, lalu lulus.
- [ ] e2e: kelola anggota (tambah leader tanpa divisi → galat); panel "Perlu tindakan" sesuai peran.
- [ ] **Uji akhir P1:**
  - `npm ci`;
  - tsc dan lint dibandingkan baseline;
  - semua unit, SQL P1, dan e2e (baru + regresi suite yang ada) lulus;
  - A/B piksel tema gelap untuk halaman yang sudah ada, tanpa tabel `mgmt_*`: harus identik;
  - dengan tabel: selisih hanya pada nav dan banner.
- [ ] Tinjauan independen (agen terpisah) atas `management-p1.sql` dan diff kode. Perbaiki temuannya.
- [ ] Kemas `$OUT/management-p1.zip`, berisi `src/...`, `package.json`, `package-lock.json`, `docs/...`.
- [ ] Commit: `feat(management): anggota, perlu tindakan, glosarium — P1 siap pasang`.

---

## P2

### Task 9: `management-p2.sql` + uji

**Files:**
- Create: `$OUT/management-p2.sql`
- Create: `$S/pgtes/uji-mgmt-p2.sh`

**Interfaces — Produces:**

```sql
create table if not exists public.mgmt_serah_terima (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('calon_klien','kartu_proyek','review_dea','portofolio','info_rilis','qc_studio_project','kalender_bulanan','lainnya')),
  dari_divisi text not null, ke_divisi text not null,
  penanggung_jawab_peran text not null,
  judul text not null, catatan text null,
  mulai timestamptz null, tanggal_rilis date null, bulan_rencana date null,   -- bulan_rencana: tgl 1 bulan yang direncanakan (kalender_bulanan)
  tenggat timestamptz not null,
  status text not null default 'berjalan' check (status in ('berjalan','selesai','batal')),
  selesai_pada timestamptz null, hasil text null,
  tautan_item text null,
  ditindaklanjuti_pada timestamptz null, catatan_tindak_lanjut text null,
  dibuat_oleh text not null, dibuat_pada timestamptz not null default now()
);
create table if not exists public.mgmt_ringkasan_harian (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, divisi text not null, tanggal date not null,
  selesai text[] not null default '{}', hambatan text[] not null default '{}',
  butuh_divisi text null,
  dikirim_pertama_pada timestamptz not null default now(), diubah_pada timestamptz not null default now(),
  unique (user_id, tanggal)
);
```

**Fungsi `mgmt_tenggat_serah_terima(p_jenis text, p_mulai timestamptz, p_tanggal_rilis date, p_bulan_rencana date, p_tenggat_manual timestamptz) returns timestamptz`** (cermin `serahTerima.ts`):

| Jenis | Tenggat |
|---|---|
| `calon_klien`, `kartu_proyek`, `review_dea` | `mgmt_tambah_jam_kerja(p_mulai, 9)` |
| `portofolio` | `mgmt_tambah_jam_kerja(p_mulai, 27)` |
| `qc_studio_project` | `mgmt_tambah_jam_kerja(p_mulai, 18)` |
| `info_rilis` | `((p_tanggal_rilis - 3) + time '18:00') at time zone 'Asia/Jakarta'` |
| `kalender_bulanan` | `(((date_trunc('month', p_bulan_rencana) - interval '1 month')::date + 24) + time '18:00') at time zone 'Asia/Jakarta'`, yaitu tanggal 25 bulan sebelumnya, pukul 18.00 |
| `lainnya` | `p_tenggat_manual` (wajib) |

**Penanggung jawab per jenis** (diisi otomatis):

| Jenis | Peran |
|---|---|
| `calon_klien` | `leader_sosmed` |
| `kartu_proyek`, `portofolio` | `leader_service` |
| `review_dea` | `owner` |
| `info_rilis`, `qc_studio_project` | `leader_marketplace` |
| `kalender_bulanan` | `leader_sosmed` bila `dari_divisi = 'sosmed'`, selain itu `leader_marketplace` |
| `lainnya` | Dipilih pembuat |

**RPC:**

| RPC | Siapa | Efek dan validasi |
|---|---|---|
| `mgmt_buat_serah_terima(p_jenis, p_dari, p_ke, p_judul, p_catatan, p_mulai, p_tanggal_rilis, p_bulan_rencana, p_tenggat_manual, p_tautan_item, p_peran_pj default null) returns json` | `bisa(serah_terima)` | `p_mulai` tidak di masa depan dan tidak lebih dari 7 hari ke belakang. Wajib diisi untuk jenis berdurasi |
| `mgmt_selesaikan_serah_terima(p_id, p_hasil text default null, p_tautan_item text default null) returns json` | Pembuat, anggota divisi tujuan, PM, SM, atau `owner` untuk `review_dea` | `kartu_proyek` wajib `tautan_item`. `qc_studio_project` wajib hasil `lolos`/`tidak_lolos`. `review_dea` wajib hasil `disetujui`/`revisi` |
| `mgmt_tindaklanjuti(p_id, p_catatan) returns json` | PM/SM | Hanya bila `now() > tenggat` dan status `berjalan` |
| `mgmt_ubah_mulai(p_id, p_mulai, p_alasan) returns json` | PM | Menghitung ulang tenggat. Alasan masuk audit |
| `mgmt_kirim_ringkasan(p_tanggal date, p_selesai text[], p_hambatan text[], p_butuh_divisi text) returns json` | Leader | Lihat **Aturan `mgmt_kirim_ringkasan`** di bawah tabel |

**Aturan `mgmt_kirim_ringkasan`**
- `p_tanggal` harus sama dengan hari ini WIB.
- Maksimal 3 butir per isian, masing-masing paling banyak 280 karakter.
- Divisi diambil dari `mgmt_divisi_saya()`.
- Upsert boleh sampai 23.59. `dikirim_pertama_pada` tidak pernah berubah.

**RLS:** select untuk `adalah_management()`, tanpa tulis langsung, dan pagar `pagar_akses_login` di kedua tabel.

**Langkah:**
- [ ] Tulis uji (harus gagal dulu):
  - **Tenggat per jenis** (nilai yang sama dipakai di unit test Task 10):

    | Jenis | Input | Tenggat (WIB) | Rincian |
    |---|---|---|---|
    | `portofolio` | mulai Kam 3 Des 2026 16:00 | Sel 8 Des 16:00 | Kam 2 jam + Jum 9 + Sen 9 + Sel 7 = 27 jam |
    | `info_rilis` | rilis 2026-12-10 | Sen 7 Des 18:00 | Tanggal rilis − 3 hari |
    | `kalender_bulanan` | bulan 2027-01-01 | Jum 25 Des 2026 18:00 | Tetap tanggal 25, walau libur |
    | `qc_studio_project` | mulai Kam 24 Des 14:00 | Sel 29 Des 14:00 | Kam 4 jam + (25 Des libur) Sen 9 + Sel 5 = 18 jam |

  - **Selesaikan:** `kartu_proyek` tanpa tautan → ditolak; `review_dea` oleh leader service → ditolak; oleh owner → berhasil.
  - **Tindak lanjut:** sebelum tenggat → ditolak.
  - **Ringkasan:** butir ke-4 → ditolak; kirim ulang → `dikirim_pertama_pada` tetap; non-leader → ditolak.
  - **RLS:** karyawan biasa 0 baris.
  - Dijalankan 2×.
- [ ] Tulis SQL sampai lulus. Jalankan 2×.

### Task 10: `src/lib/management/serahTerima.ts` + unit test

**Files:**
- Create: `src/lib/management/serahTerima.ts`
- Test: `$S/unit/serahTerima.test.ts`

**Interfaces — Produces:**

```ts
export type JenisSerahTerima = "calon_klien" | "kartu_proyek" | "review_dea" | "portofolio" | "info_rilis" | "qc_studio_project" | "kalender_bulanan" | "lainnya";
export const DURASI_JAM: Partial<Record<JenisSerahTerima, number>>;   // { calon_klien: 9, kartu_proyek: 9, review_dea: 9, portofolio: 27, qc_studio_project: 18 }
export const LABEL_JENIS: Record<JenisSerahTerima, string>;
export function tenggatSerahTerima(jenis: JenisSerahTerima, i: { mulai?: Date | null; tanggalRilis?: string | null; bulanRencana?: string | null; tenggatManual?: Date | null }, peta?: PetaLibur | null): Date;
export type Warna = "selesai" | "merah" | "kuning" | "normal";
export function warnaKartu(k: { status: string; dibuatPada: string; mulai?: string | null; tenggat: string }, sekarang: Date): Warna;   // kuning: sisa < 25% dari (tenggat − (mulai ?? dibuatPada))
export function batasTindakLanjut(tenggat: Date, peta?: PetaLibur | null): Date;
export function tepatWaktu(k: { tenggat: string; selesaiPada: string | null }): boolean | null;   // null = belum selesai
export async function muatSerahTerima(sb: any): Promise<any[] | null>;
export async function buatSerahTerima(sb: any, d: Record<string, unknown>): Promise<HasilRpc>;
export async function selesaikanSerahTerima(sb: any, id: string, hasil?: string, tautan?: string): Promise<HasilRpc>;
export async function tindaklanjuti(sb: any, id: string, catatan: string): Promise<HasilRpc>;
```

**Aturan `batasTindakLanjut`:**

| Tenggat | Batas tindak lanjut |
|---|---|
| Hari kerja, pukul 09:00 sampai sebelum 15:00 | 18:00 hari yang sama |
| Hari kerja, pukul 15:00 atau lebih (termasuk tenggat 18:00 tepat) | 12:00 hari kerja berikutnya |
| Hari non-kerja, atau sebelum 09:00 | 12:00 hari kerja pertama yang dimulai setelah tenggat |

- [ ] **Step 1: Tulis test yang gagal**

```ts
// $S/unit/serahTerima.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { tenggatSerahTerima, batasTindakLanjut, warnaKartu } from "../../invisual-hris/src/lib/management/serahTerima.ts";
import { instanWib } from "../../invisual-hris/src/lib/management/hariKerja.ts";

const peta = new Map([["2026-12-25", { tanggal: "2026-12-25", nama: "Natal", jenis: "nasional", libur: true }]]) as any;
const w = (iso: string, j: number, m = 0) => instanWib(iso, j, m);
const eq = (a: Date, b: Date) => assert.equal(a.toISOString(), b.toISOString());

test("tenggat per jenis (sama dengan uji SQL)", () => {
  eq(tenggatSerahTerima("portofolio", { mulai: w("2026-12-03", 16) }, peta), w("2026-12-08", 16));
  eq(tenggatSerahTerima("info_rilis", { tanggalRilis: "2026-12-10" }, peta), w("2026-12-07", 18));
  eq(tenggatSerahTerima("kalender_bulanan", { bulanRencana: "2027-01-01" }, peta), w("2026-12-25", 18));
  eq(tenggatSerahTerima("qc_studio_project", { mulai: w("2026-12-24", 14) }, peta), w("2026-12-29", 14));
  assert.throws(() => tenggatSerahTerima("lainnya", {}, peta));
});

test("batas tindak lanjut", () => {
  eq(batasTindakLanjut(w("2026-12-01", 11), peta), w("2026-12-01", 18));
  eq(batasTindakLanjut(w("2026-12-01", 18), peta), w("2026-12-02", 12));
  eq(batasTindakLanjut(w("2026-12-04", 16), peta), w("2026-12-07", 12));
  eq(batasTindakLanjut(w("2026-12-24", 18), peta), w("2026-12-28", 12));
  eq(batasTindakLanjut(w("2026-12-01", 7), peta), w("2026-12-01", 12));
});

test("warna kartu", () => {
  const k = { status: "berjalan", dibuatPada: "2026-12-01T02:00:00Z", mulai: "2026-12-01T02:00:00Z", tenggat: "2026-12-01T11:00:00Z" };
  assert.equal(warnaKartu(k, new Date("2026-12-01T03:00:00Z")), "normal");
  assert.equal(warnaKartu(k, new Date("2026-12-01T09:30:00Z")), "kuning");
  assert.equal(warnaKartu(k, new Date("2026-12-01T11:01:00Z")), "merah");
  assert.equal(warnaKartu({ ...k, status: "selesai" }, new Date("2026-12-02T00:00:00Z")), "selesai");
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --experimental-strip-types --test $S/unit/serahTerima.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasi bagian murni**

```ts
// src/lib/management/serahTerima.ts (bagian murni) — CERMIN mgmt_tenggat_serah_terima()
import type { PetaLibur } from "../hariLibur";
import { tambahJamKerja, instanWib, tambahHariIso, adalahHariKerja, isoWib, JAM_MULAI, JAM_SELESAI } from "./hariKerja.ts";

export const DURASI_JAM: Partial<Record<JenisSerahTerima, number>> = { calon_klien: 9, kartu_proyek: 9, review_dea: 9, portofolio: 27, qc_studio_project: 18 };

export function tenggatSerahTerima(jenis: JenisSerahTerima, i: { mulai?: Date | null; tanggalRilis?: string | null; bulanRencana?: string | null; tenggatManual?: Date | null }, peta?: PetaLibur | null): Date {
  const durasi = DURASI_JAM[jenis];
  if (durasi) { if (!i.mulai) throw new Error("Waktu mulai wajib diisi."); return tambahJamKerja(i.mulai, durasi, peta); }
  if (jenis === "info_rilis") { if (!i.tanggalRilis) throw new Error("Tanggal rilis wajib diisi."); return instanWib(tambahHariIso(i.tanggalRilis, -3), JAM_SELESAI); }
  if (jenis === "kalender_bulanan") {
    if (!i.bulanRencana) throw new Error("Bulan rencana wajib diisi.");
    const awal = `${i.bulanRencana.slice(0, 7)}-01`;
    const akhirBulanLalu = tambahHariIso(awal, -1);            // YYYY-MM-(28..31) bulan sebelumnya
    return instanWib(`${akhirBulanLalu.slice(0, 7)}-25`, JAM_SELESAI);
  }
  if (!i.tenggatManual) throw new Error("Tenggat wajib diisi.");
  return i.tenggatManual;
}

export function batasTindakLanjut(tenggat: Date, peta?: PetaLibur | null): Date {
  const iso = isoWib(tenggat);
  const jamWib = (tenggat.getTime() - instanWib(iso, 0).getTime()) / 3_600_000;
  if (adalahHariKerja(iso, peta) && jamWib >= JAM_MULAI && jamWib < 15) return instanWib(iso, JAM_SELESAI);
  let d = adalahHariKerja(iso, peta) && jamWib < JAM_MULAI ? iso : tambahHariIso(iso, 1);
  for (let i = 0; i < 400 && !adalahHariKerja(d, peta); i++) d = tambahHariIso(d, 1);
  return instanWib(d, 12);
}

export function warnaKartu(k: { status: string; dibuatPada: string; mulai?: string | null; tenggat: string }, sekarang: Date): Warna {
  if (k.status !== "berjalan") return "selesai";
  const t = Date.parse(k.tenggat), s = sekarang.getTime();
  if (s > t) return "merah";
  const awal = Date.parse(k.mulai || k.dibuatPada);
  return t - s < 0.25 * (t - awal) ? "kuning" : "normal";
}

export const tepatWaktu = (k: { tenggat: string; selesaiPada: string | null }) =>
  k.selesaiPada ? Date.parse(k.selesaiPada) <= Date.parse(k.tenggat) : null;
```

Catatan impor: `./hariKerja.ts` memakai ekstensi `.ts` agar jalan di Node. Tambahkan `"allowImportingTsExtensions": true` ke `tsconfig.json` hanya bila tsc menolaknya. Karena `noEmit: true` sudah aktif, opsi ini aman.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node --experimental-strip-types --test $S/unit/serahTerima.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/management/serahTerima.ts
git commit -m "feat(management): tenggat serah terima, warna, batas tindak lanjut"
```

### Task 11: Tab Serah Terima

**Files:**
- Create: `src/components/management/TabSerahTerima.tsx`
- Create: `src/components/management/FormSerahTerima.tsx`
- Modify: `src/components/management/Management.tsx` (tab `serah-terima`, tampil bila `muatSerahTerima` tidak null)

**Perilaku:**
- **Papan** dengan kolom "Berjalan · Terlambat · Selesai minggu ini".
- **Label kartu:**

  | Warna | Label |
  |---|---|
  | `merah` | "Terlambat" |
  | `kuning` | "Hampir tenggat" |

- **Filter:** divisi dan jenis.
- **Ringkasan ketepatan per divisi** untuk bulan berjalan, dari `tepatWaktu` dan berdasarkan `penanggung_jawab_peran`.
- **Formulir:**
  - Isian berubah sesuai jenis (mulai, tanggal rilis, bulan rencana, atau tenggat manual).
  - Pratinjau tenggat memakai `tenggatSerahTerima` dan peta libur (`hari_libur`).
- **Aksi:**
  - Selesaikan, dengan isian hasil/tautan sesuai jenis.
  - "Sudah ditindaklanjuti" pada kartu merah (PM/SM), menampilkan `batasTindakLanjut`.
  - "Ubah waktu mulai" (PM).

Langkah:
- [ ] Tambahkan skenario e2e (harus gagal dulu):
  - buat `info_rilis` dengan rilis besok → langsung "Terlambat";
  - `kartu_proyek` diselesaikan tanpa tautan → galat;
  - PM menindaklanjuti kartu merah → label berubah "Ditindaklanjuti";
  - leader tidak melihat tombol tindak lanjut.
- [ ] Implementasikan sampai lulus. Jalankan tsc dan lint.
- [ ] Commit: `feat(management): tab Serah Terima`.

### Task 12: Ringkasan Harian + "Perlu tindakan" P2

**Files:**
- Create: `src/lib/management/harian.ts`
- Create: `src/components/management/TabHarian.tsx`
- Modify: `src/lib/management/perluTindakan.ts`
- Modify: `src/components/management/Management.tsx`
- Test: `$S/unit/harian.test.ts`, dan tambahan kasus di `$S/unit/perluTindakan.test.ts`

**Interfaces — Produces:**

```ts
export const BATAS_RINGKASAN = { jam: 18, menit: 0 } as const;
export function ringkasanTepatWaktu(dikirimPertamaPada: string, tanggal: string): boolean;   // < 18:00 WIB pada `tanggal`
export function hariDihitung(tanggal: string, peta: PetaLibur | null, cutiDisetujui: Set<string>): boolean; // hari kerja & bukan cuti/izin/sakit Disetujui
export function validasiButir(butir: string[]): string | null;   // > 3 butir / > 280 karakter → pesan
export async function kirimRingkasan(sb: any, d: { tanggal: string; selesai: string[]; hambatan: string[]; butuhDivisi: string | null }): Promise<HasilRpc>;
export async function muatRingkasan(sb: any, dari: string, sampai: string): Promise<any[] | null>;
```

`cutiDisetujui` dibangun dari `approvals` milik leader dengan `status` "Disetujui" dan `jenis` cuti/izin/sakit. Cocokkan dengan format `tanggal` yang dipakai `rentangPengajuan.ts` (lihat `src/lib/rentangPengajuan.ts`).

**Tambahan pada `hitungPerluTindakan`:**

| Untuk | Item |
|---|---|
| Leader | "Isi Ringkasan Harian" bila hari ini dihitung dan belum ada ringkasan. Item `mendesak` setelah 17:00 |
| Leader | "Serah terima masuk" untuk kartu `berjalan` dengan `ke_divisi` = divisinya |
| PM | "Kartu terlambat" untuk kartu merah yang belum ditindaklanjuti |
| PM | "Butuh bantuan" dari ringkasan hari ini yang `butuh_divisi`-nya terisi |
| Leader divisi tujuan | "Butuh bantuan" dari ringkasan hari ini yang `butuh_divisi` = divisinya |
| Owner | "Review Dea menunggu" untuk `review_dea` yang `berjalan` |

**Tampilan `TabHarian`:**
- Formulir milik leader: 3 butir per isian, dengan penghitung karakter.
- Linimasa per hari untuk ketiga leader, berlabel "Tepat waktu" atau "Terlambat".
- Leader yang sedang cuti tampil sebagai "Cuti", tanpa label terlambat.

Langkah:
- [ ] Unit test (harus gagal dulu):
  - `ringkasanTepatWaktu("2026-12-01T10:59:00Z", "2026-12-01")` = true (17:59 WIB);
  - `ringkasanTepatWaktu("2026-12-01T11:00:00Z", "2026-12-01")` = false;
  - `hariDihitung` untuk Sabtu = false, 2026-12-25 = false, hari cuti = false;
  - `validasiButir` untuk 4 butir dan untuk 281 karakter;
  - kasus baru di `perluTindakan.test.ts` untuk setiap baris tabel di atas.
- [ ] Implementasikan sampai lulus. Lanjutkan dengan e2e: kirim ringkasan, kirim ulang (label tetap "Tepat waktu" bila kirim pertama < 18:00), dan hambatan "Butuh bantuan dari Service" muncul di panel PM.
- [ ] Commit: `feat(management): Ringkasan Harian & perlu tindakan P2`.

### Task 13: Pengingat pagi (push) + ekstraksi `kirimPush`

**Files:**
- Create: `src/lib/server/kirimPush.ts`
- Modify: `src/app/api/push/send/route.ts`, supaya memanggil `kirimPush`. Perilaku dan respons **tidak berubah**.
- Create: `src/app/api/management/pengingat/route.ts`
- Modify: `vercel.json`, tambah `{ "path": "/api/management/pengingat", "schedule": "30 1 * * 1-5" }` (08.30 WIB).

**Interfaces — Produces:**

```ts
// src/lib/server/kirimPush.ts (server saja)
export async function kirimPush(admin: SupabaseClient, memberIds: string[], isi: { title: string; body: string; url: string; tag?: string }): Promise<{ sent: number; dead: number }>;
// /api/management/pengingat — GET
// 401 bila header Authorization ≠ `Bearer ${process.env.CRON_SECRET}`; 200 {ok:true, dikirim:n, dilewati:"libur"} bila hari ini bukan hari kerja.
```

**Isi pengingat:**
- Pengingat dikirim ke setiap anggota `mgmt_anggota` yang aktif dan punya `user_id`.
- Isinya dihitung dengan `hitungPerluTindakan` dari data yang dimuat lewat service role.
- Bila jumlahnya lebih dari 0, kirim push berbunyi: judul "Management — n hal perlu tindakan", isi diambil dari 2 judul pertama, dan URL `/user/management?tab=ringkasan`. Untuk akun `@invisual.studio`, URL-nya `/admin/management?tab=ringkasan`.

**Di luar rencana ini:** pengingat berjam dari PRD (Jumat 15.00, H-1 15.00, pukul 17.00) baru ditambahkan bila paket Vercel mengizinkan cron per jam. Selama itu, panel "Perlu tindakan" menandai item `mendesak`.

**Pengingat baca Pedoman:**
- Dikirim ke leader untuk anggota divisinya yang belum mengonfirmasi lebih dari 27 jam kerja sejak `diterbitkan_pada`.
- Karyawan yang belum dipetakan divisinya membuat pengingat dikirim ke HR.

Langkah:
- [ ] Uji regresi `/api/push/send` dengan mock web-push: respons sama sebelum dan sesudah ekstraksi, untuk kasus `memberIds` dan `toAdmins`.
- [ ] Uji rute pengingat dengan mock:
  - tanpa secret → 401;
  - hari libur (2026-12-25) → dilewati;
  - PM dengan 1 usulan `diajukan` → 1 push;
  - anggota tanpa tindakan → tidak ada push.
- [ ] Implementasikan. Tambahkan `CRON_SECRET` ke daftar env yang perlu diisi di Vercel (catat di dokumen pemasangan).
- [ ] Commit: `feat(management): pengingat pagi via Vercel Cron`.

### Task 14: Impor CSV dari sheet, uji akhir P2, kemas

**Files:**
- Create: `src/components/management/ImporCsv.tsx` (memakai `papaparse` yang sudah ada)
- Modify: `src/components/management/KelolaAnggota.tsx` (tombol "Impor dari sheet", hanya PM/SM)

**Perilaku:**
- Impor dilakukan sekali untuk dua jenis CSV hasil ekspor sheet sementara:
  - **Usulan:** kolom `judul, masalah, perubahan, bagian, divisi, sumber, jalur, status_akhir, tanggal`. Setiap baris dibuat lewat `mgmt_ajukan_usulan` dan dicatat "Diimpor dari sheet". Status akhir lalu diterapkan lewat RPC yang sesuai.
  - **Serah terima:** baris yang masih `berjalan` dibuat lewat `mgmt_buat_serah_terima`.
- Ada pratinjau dan validasi per baris sebelum impor. Baris yang gagal ditampilkan beserta alasannya.

Langkah:
- [ ] e2e: CSV contoh berisi 3 usulan dan 2 serah terima. Satu baris rusak → laporan galat, dan baris lain tetap masuk.
- [ ] **Uji akhir P2:**
  - unit, SQL P1 dan P2, e2e penuh, serta regresi lulus;
  - tsc dan lint sama dengan baseline;
  - A/B piksel tema gelap: halaman lama identik.
- [ ] Tinjauan independen atas `management-p2.sql` dan diff. Perbaiki temuannya.
- [ ] Kemas `$OUT/management-p2.zip`.
- [ ] Commit: `feat(management): impor CSV sheet — P2 siap pasang`.

---

## Rencana lanjutan (garis besar; rencana rinci dibuat setelah P2 terpasang)

- **P3 — Rapat** (`management-p3.sql`):
  - Tabel: `mgmt_rapat`, `mgmt_rapat_hadir`, `mgmt_tugas`.
  - RPC: `mgmt_buat_rapat` (agenda otomatis dari usulan `siap_diputuskan`, darurat, kartu merah, dan ringkasan KPI bila sudah ada), `mgmt_bagikan_agenda`, `mgmt_unggah_notulen`, `mgmt_catat_hadir`, `mgmt_buat_tugas`, `mgmt_selesaikan_tugas`.
  - Jenis `sinkron_owner` dipakai untuk KPI SM6.
  - Keputusan usulan dari layar rapat mengisi `rapat_id`.
  - Tugas masuk ke `hitungPerluTindakan`.
- **P4 — KPI** (`management-p4.sql`):
  - Tabel: `mgmt_kpi_definisi` (37 baris SV1–HR6 dari spec sistem kerja Bagian 5), `mgmt_kpi_isian`, `mgmt_kpi_baseline`, `mgmt_laporan_bulanan`.
  - Kolom `approvals."diajukanPada"`/`"diputuskanPada"` beserta trigger.
  - `lib/management/skorKpi.ts` (murni, cermin SQL): jenis target, agregasi, redistribusi bobot, baseline bergulir, label "Kalibrasi" sebelum `mgmt_mulai_penilaian`.
  - Formulir Laporan Mingguan, kartu skor, dasbor, serta laporan bulanan dengan ekspor PDF (jspdf) dan tombol Terbitkan.
- **P5 — Lainnya** (`management-p5.sql`):
  - `mgmt_bank_ide` (penghitung ide per minggu untuk MP5);
  - `mgmt_kalender` (tombol ajukan → menyelesaikan serah terima `kalender_bulanan`);
  - `mgmt_calon_klien` (membuat serah terima `calon_klien`; tanpa telepon/email klien);
  - `mgmt_kepatuhan_jalur` (tidak bisa diubah setelah 24 jam; view menyembunyikan pelapor kecuali untuk owner/HR);
  - `mgmt_satu_satu` (hanya kedua pihak).
