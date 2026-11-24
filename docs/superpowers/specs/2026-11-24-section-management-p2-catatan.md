# Section Management P2 — catatan implementasi (24 Nov 2026)

Melengkapi `2026-11-24-section-management-prd.md` (P2a Serah Terima, P2b Ringkasan Harian) dan rencana `../plans/2026-11-24-section-management-p1-p2.md` (Task 9–14). Berkas pasang: `management-p2.zip` (kode) lalu `management-p2.sql`.

## Yang dibangun
| Bagian | Isi |
|---|---|
| SQL | `mgmt_serah_terima`, `mgmt_ringkasan_harian` (RLS baca anggota Management + `pagar_akses_login`, tanpa tulis langsung); `mgmt_tenggat_serah_terima` (cermin `serahTerima.ts`); RPC buat/selesaikan/tindak lanjuti/ubah mulai/batalkan serah terima, kirim ringkasan, `mgmt_cuti_leader`, `mgmt_impor_usulan` |
| Pustaka | `src/lib/management/` serahTerima, harian, pengingat, imporCsv; `src/lib/server/kirimPush.ts` |
| Tampilan | Tab **Serah Terima** (papan Berjalan · Terlambat · Selesai minggu ini, filter, ketepatan bulan ini, formulir + pratinjau tenggat), tab **Harian** (formulir leader + linimasa 5 hari kerja), papan P2 & item P2 di "Perlu tindakan", **Impor dari sheet** di tab Anggota |
| Cron | `/api/management/pengingat` — Vercel Cron `30 1 * * 1-5` (08.30 WIB hari kerja; libur dilewati) |

Tab & papan P2 hanya tampil bila tabelnya bisa dibaca → kode aman dipasang sebelum SQL; tanpa SQL P2 tampilan identik dengan P1 (A/B piksel).

## Penyesuaian dari rencana (hasil uji & tinjauan independen)
- **Cuti leader** (`mgmt_cuti_leader`): `approvals` hanya bisa dibaca pemilik & HR, jadi PM/SM membaca tanggal cuti/izin/sakit Disetujui milik leader lewat fungsi terbatas: hanya anggota Management, hanya leader aktif, hanya (divisi, tanggal), jendela 31 hari ke belakang s/d 7 hari ke depan, hanya pengajuan yang beririsan. Jenis: Cuti*, Izin Sakit, Izin Tidak Masuk (bukan Izin Terlambat/WFH/WFC).
- **Penanggung jawab SLA** boleh menyelesaikan kartu (mis. Leader Sosmed untuk Calon klien → Dea) dan mendapat item "Serah terima tanggung jawab Anda".
- **Tindak lanjut** PM hanya sekali per kartu (data KPI PM2 tidak tertimpa).
- **Buat serah terima**: asal ≠ tujuan, judul ≤ 200 / catatan ≤ 1000 / tautan ≤ 500 karakter, tenggat "Lainnya" tidak boleh lampau.
- **Impor dari sheet**: status akhir usulan (Disetujui/Ditolak/Ditunda/Berlaku/Dicabut) tidak bisa melalui alur normal (cek dampak → putuskan) untuk keputusan lampau, maka dibuat RPC `mgmt_impor_usulan` — **hanya Studio Manager** (keputusan usulan milik SM), jalur Biasa, tanggal tidak di masa depan, impor ganda ditolak, tercatat "Diimpor dari sheet" + audit. Usulan "Diajukan" lewat `mgmt_ajukan_usulan`; serah terima hanya yang **Berjalan** (mulai ≤ 7 hari lalu — batas sistem).
- **Pengingat pagi**: penerima dihitung sama dengan `mgmt_peran_saya` (baris anggota aktif + owner + akun @invisual.studio = SM+PM+HR, termasuk akun Auth tanpa baris karyawan); karyawan nonaktif/akses ditutup dilewati; rute **tidak mengirim apa pun sebelum SQL P2 dijalankan**; respons tanpa rincian penerima.
- `/api/push/send` memakai `kirimPush` — respons, payload, & pembersihan langganan identik (diuji berdampingan dengan rute lama, 12 skenario).
- Ringkasan Harian: hari sebelum ringkasan pertama → "Belum berlaku"; divisi tanpa leader → "Tanpa leader"; papan Ringkasan di hari libur → "bukan hari kerja".
- Serah Terima memuat kartu berjalan + yang dibuat/selesai sejak awal bulan lalu (beban tidak tumbuh terus).

## Pengujian (24 Nov 2026)
- SQL lokal (tiruan Supabase + akses-login + P1): P2 87 cek ×2 (termasuk pasang 2× = idempoten); P1 tetap 149.
- Unit: hariKerja 3, usulan 4, pedoman 3, perluTindakan 10, serahTerima 6 (+ 200 waktu acak cocok dengan SQL), harian 5, imporCsv 4, kirimPush 14 (regresi rute lama vs baru), pengingat 8.
- e2e (Playwright + tiruan): Serah Terima, Harian, Impor CSV, regresi P1 & akses login; A/B piksel tema gelap 17 halaman × desktop/ponsel.

## Cara pasang (urutan)
1. Kode: unzip `management-p2.zip` di root repo → `npm install && npm run build` → commit & push (Vercel deploy). Tanpa SQL P2 tidak ada perubahan tampilan/fungsi.
2. Vercel → Settings → Environment Variables: tambah **`CRON_SECRET`** (teks acak panjang, Sensitive, Production). Catatan: dua cron lama (bersihkan foto absen & Cloudinary) juga memakai secret ini dan akan mulai berjalan otomatis tiap malam.
3. SQL: jalankan `management-p2.sql` di Supabase SQL Editor (satu transaksi, aman diulang).
4. Impor sheet (sekali, oleh Studio Manager): Management → Anggota → **Impor dari sheet** → pilih CSV usulan, lalu CSV serah terima.

## Darurat
`revoke select on public.mgmt_serah_terima, public.mgmt_ringkasan_harian from authenticated;` → tab Serah Terima & Harian dan papan P2 tersembunyi; data utuh. Pulihkan dengan `grant select … to authenticated;`. Pengingat pagi memakai service role, jadi dihentikan terpisah: hapus `CRON_SECRET` di Vercel (atau entri `/api/management/pengingat` di `vercel.json`).

## Di luar P2
- Pengingat berjam (Jumat 15.00, H-1 15.00, 17.00) menunggu paket Vercel yang mengizinkan cron per jam; sementara itu panel "Perlu tindakan" menandai item `mendesak`.
- Galat tipe `web-push` (TS7016) sudah ada di baseline; build mengabaikan galat tipe.
