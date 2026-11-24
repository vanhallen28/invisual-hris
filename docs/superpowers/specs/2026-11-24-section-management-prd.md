# Section Management HRIS — PRD (24 Nov 2026)

Dokumen ini meminta dibangunnya **satu section baru di HRIS** bernama menu **Management**. Section ini menjadi wadah interaksi management. Semua perkembangan lintas divisi, baik proses maupun strategi, tersedia di sini. Section ini juga menegakkan aturan main dalam `2026-11-24-sistem-kerja-management-design.md`, yang di bawah disebut "Pedoman".

Keputusan pengguna yang mengikat PRD ini (24 Nov 2026):
- Menu Management tersedia di kedua portal.
- Akses ditentukan oleh daftar anggota khusus.
- Tab Pedoman **wajib dibaca semua karyawan**.
- KPI memakai dua sumber: otomatis dan diisi leader.
- Tidak ada integrasi API Instagram atau Canva.

## Latar (dicek di repo dan database 24 Nov 2026, baca saja)

**Teknologi**
- Next.js 16, React 19, Supabase (proyek "Invisual HRIS"), Vercel (proyek `invisual-hris`, region `hnd1`).
- Vercel Cron sudah dipakai untuk dua rute pembersihan.
- `pg_cron` terpasang.

**Dua portal**

| Portal | Pengguna | Penjaga akses |
|---|---|---|
| `/admin` | Akun `@invisual.studio`: owner (`OWNER_EMAILS`: Dea, Riza, Tryan) dan akun HR | Layout memeriksa domain email; RLS memeriksa `adalah_hr()` |
| `/user` | Karyawan dengan akun pribadi, **termasuk** Studio Manager, PM, HR (akun pribadi), dan para leader | — |

**Peran Daily Task**
- `members.role` berisi `manager` (17 akun) dan `member` (23 akun).
- Peran `manager` terlalu luas, sehingga **tidak boleh** dipakai sebagai penentu akses Management.

**Board Daily Task per bulan:** CLIENT WORK, MARKETING/SOSMED, MARKETPLACE (sub-board Canva, Adobe Express, per orang), STUDIO PROJECT. Gerbang "Menunggu ACC" brief sudah ada (`lib/tracker/acc.ts`).

**Tabel `approvals`** (Pengajuan) tidak menyimpan waktu diajukan maupun waktu diputuskan. Kolomnya: `tanggal`, `status` (teks), dan lainnya.

**Kemampuan yang sudah ada:**
- `/api/wa` hanya untuk admin, berupa siaran lewat Fonnte.
- Push lewat `/api/push/send`.
- `logAudit` dan tabel `audit_log`.
- `hariLibur.ts`, berisi `hari_libur` dengan jenis nasional, cuti bersama, dan kantor.
- `jamKerja.ts`, dengan jam 09:00–18:00 di `pengaturan`.
- `sanitasiHtml.ts` dan DOMPurify.
- jspdf (dipakai untuk slip gaji).

## Tujuan dan ukuran keberhasilan

1. Hanya ada **satu pintu aturan.**
   - Setiap aturan yang berlaku dapat ditelusuri ke versi Pedoman dan ke usulan yang mengesahkannya.
   - Ukuran: setelah 3 bulan, 100% perubahan Pedoman tertaut ke usulan.
2. **Serah terima lintas divisi terlihat.** Setiap serah terima punya tenggat, dan yang terlambat otomatis ditandai merah.
   - Ukuran: ketepatan serah terima minimal 90% setelah 3 bulan.
3. **Ritme rapat berjalan.** Agenda dan notulen berada di satu tempat, dan keputusan rapat menjadi tugas.
   - Ukuran: rapat mingguan tercatat minimal 90%.
4. **KPI keenam peran terhitung** tanpa rekap manual di luar HRIS.
5. **Semua karyawan sudah membaca Pedoman** versi yang berlaku.
   - Ukuran: minimal 95% konfirmasi paling lambat 3 hari kerja setelah versi baru terbit.

## Pengguna dan peran

**Tabel anggota**
- Tabel baru `mgmt_anggota` menentukan anggota Management. Pengelolanya HR dan Studio Manager.
- Peran yang tersedia: `studio_manager`, `pm`, `hr`, `leader_sosmed`, `leader_service`, `leader_marketplace`, `owner`.
- Satu orang boleh memegang lebih dari satu baris peran.
- Pencocokan akun memakai `user_id`, **atau** `email`/`emailLogin`, sama seperti `baris_saya()`.
  - Dengan begitu akun pribadi HR maupun akun `@invisual.studio` HR sama-sama dikenali.
- Akun di `OWNER_EMAILS` otomatis dianggap ber-peran `owner`, walaupun tidak ada barisnya di tabel.

**Hak per peran** (✓ = boleh, R = hanya baca, — = tidak tampil)

| Aksi | Studio Manager | PM | HR | Leader | Owner | Karyawan lain |
|---|---|---|---|---|---|---|
| Baca Pedoman berlaku dan riwayatnya | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Konfirmasi "sudah membaca" | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lihat status baca semua orang | ✓ | ✓ | ✓ | Anggota divisinya | ✓ | — |
| Buat dan terbitkan versi Pedoman | ✓ | ✓ | — | — | R | — |
| Ajukan usulan | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Teruskan usulan ke cek dampak | ✓ | ✓ | — | — | — | — |
| Isi cek dampak | — | — | ✓ (sebagai divisi HR) | ✓ (divisinya) | — | — |
| Putuskan usulan / sahkan darurat | ✓ | — | — | — | — | — |
| Catat usulan atas nama owner | ✓ | — | — | — | — | — |
| Buat atau terima serah terima | ✓ | ✓ | — | ✓ | ✓ (`review_dea`) | — |
| Tandai "sudah ditindaklanjuti" | ✓ | ✓ | — | — | — | — |
| Ringkasan Harian | R | R | R | ✓ (milik sendiri) | R | — |
| Rapat: agenda, notulen, tugas | ✓ | ✓ | R + tugas sendiri | R + tugas sendiri | R | — |
| Isi KPI manual | ✓ (miliknya) | ✓ (miliknya) | ✓ (miliknya) | ✓ (miliknya) | — | — |
| Lihat skor KPI | Semua | Semua | Semua | Rincian miliknya; total skor peran lain tanpa rincian | Semua | — |
| Kelola anggota Management | ✓ | — | ✓ | — | ✓ | — |

## Letak dan navigasi

**Rute**
- Rute baru: `/user/management` dan `/admin/management`.
- Keduanya memakai satu komponen, `components/management/Management.tsx`.

**Kemunculan menu**
- Menu **Management** muncul bila `adalah_management()` bernilai true.
- **Karyawan lain hanya melihat tab Pedoman:**
  - Di portal karyawan, tab ini ditampilkan sebagai menu **Pedoman**.
  - Tab lain tidak dirender, dan RLS ikut menolaknya.
- Di `/admin`, menu masuk grup sidebar "Kolaborasi". Di ponsel, menu masuk "Lainnya".

**Tab section Management**

| Tab | Isi |
|---|---|
| **Ringkasan** | Panel "Perlu tindakan saya" dan papan kondisi lintas divisi |
| **Pedoman** | Pedoman berlaku dan riwayat versinya |
| **Usulan** | Log Usulan Perubahan |
| **Serah Terima** | Kartu serah terima lintas divisi |
| **Harian** | Ringkasan Harian leader |
| **Rapat** | Agenda, notulen, dan tugas hasil rapat |
| **KPI** | Isian, skor, dan dashboard |
| **Lainnya** (P5) | Bank Ide, Kalender, Calon Klien, Kepatuhan Jalur, 1-on-1 |

Tab yang tabelnya belum dipasang **disembunyikan**. Hal yang sama berlaku bila tabel `mgmt_*` belum ada: menu tersembunyi dan aplikasi berjalan seperti sekarang.

**Glosarium:** istilah baru ditambahkan ke `docs/glosarium-istilah.md`.
- **Management** (menu)
- **Pedoman**
- **Usulan** (bukan "Pengajuan", yang sudah dipakai untuk cuti/izin)
- **Cek dampak**
- **Serah terima**
- **Ringkasan harian**
- **Kepatuhan jalur**

## Fitur

Prioritas mengikuti Pedoman Bagian 6. **P1–P2 wajib siap sebelum 1 Feb 2027.**

### P1a — Pedoman (wajib dibaca)

**Cerita pengguna**
- Sebagai karyawan, saya membaca Pedoman yang berlaku dan menandai sudah membacanya, agar saya tahu aturan mana yang sah.
- Sebagai PM, saya menerbitkan versi baru yang tertaut ke usulan yang mengesahkannya.

**Aturan**
- **Isi versi:**
  - Isi Pedoman disimpan per versi dalam format Markdown.
  - Saat ditampilkan, Markdown dirender lalu **disanitasi dengan DOMPurify**.
  - Halaman dilengkapi daftar isi dan penanda ke setiap bagian.
- **Status versi:**
  - Status versi: `draf`, `berlaku`, atau `arsip`. Hanya **satu** versi boleh `berlaku`.
  - Saat versi baru diterbitkan, versi lama otomatis menjadi `arsip`.
- **Syarat menerbitkan versi:**
  - Wajib tertaut ke **minimal satu usulan** berstatus `disetujui`, `uji_coba`, atau `berlaku_darurat`.
  - Untuk versi yang **mengembalikan** aturan, usulan berstatus `gugur`, `dicabut`, atau `ditolak` juga boleh ditautkan.
  - Pengecualiannya v1.0, yang ditandai "Pengesahan awal" oleh Studio Manager dengan tanggal rapat pengesahan.
  - Wajib mengisi "Ringkasan perubahan" dan tanggal "Berlaku mulai".
- **Aturan internal divisi** (usulan jalur `internal` yang berlaku) tampil otomatis di bagian akhir Pedoman sebagai "Aturan internal divisi".
  - Bagian ini tidak menaikkan versi.
- **Konfirmasi baca:**
  - Selama versi berlaku belum dikonfirmasi, kedua portal menampilkan **banner tetap**: "Pedoman v1.1 berlaku mulai Sen, 18 Jan 2027 — Baca & konfirmasi".
  - Konfirmasi baru bisa ditekan setelah halaman Pedoman digulir sampai akhir.
  - Konfirmasi **tidak memblokir** Clock In, Daily Task, maupun Chat.
- **Status baca:**
  - Panel "Belum membaca" (HR, PM, Studio Manager) berisi nama, divisi, dan lama sejak terbit.
  - Leader melihat status baca anggota divisinya sendiri.
  - Pembagian divisi diambil dari `mgmt_divisi_staf`. Karyawan yang belum dipetakan tampil di grup "Belum dipetakan", dan pengingatnya dikirim ke HR.
  - Bila belum dikonfirmasi lewat 3 hari kerja, leader karyawan itu menerima pengingat.
- Riwayat versi menampilkan perbandingan teks antarversi (diff baris) dan tautan ke usulan.

**Kriteria terima**
- Karyawan non-management hanya bisa membaca versi `berlaku` dan `arsip`, dan hanya bisa menambah konfirmasi miliknya sendiri.
- Menerbitkan versi tanpa usulan tertaut ditolak, kecuali "Pengesahan awal".
- Banner hilang setelah konfirmasi. Saat versi baru terbit, banner muncul lagi.

### P1b — Log Usulan Perubahan

**Cerita pengguna**
- Sebagai anggota management, saya mencatat usulan aturan, alih-alih mengirimnya lewat WA.
- Sebagai leader, saya menilai dampak usulan terhadap divisi saya sebelum rapat.
- Sebagai Studio Manager, saya memutuskan usulan dan alasannya tercatat.

**Formulir usulan**

| Isian | Wajib | Keterangan |
|---|---|---|
| Judul | Ya | — |
| Masalah yang diselesaikan | Ya | — |
| Perubahan yang diusulkan | Ya | — |
| Bagian Pedoman yang terkena | Ya | Pilih dari judul-judul bagian versi berlaku |
| Divisi terdampak | Ya | Sosmed, Service, Marketplace, HR, Semua |
| Sumber | Ya | Rapat, HR, leader, chat/WA, owner, PM, Studio Manager |
| Jalur | Ya | Biasa, darurat (hanya Studio Manager), atau internal (hanya leader, dan hanya untuk divisinya sendiri) |

- Setiap usulan mendapat nomor otomatis berformat `U-2026-001`.

**Alur status (jalur biasa)**

```
diajukan ──(PM/SM: teruskan, pilih divisi)──▶ cek_dampak ──(semua divisi terisi, atau H-1 rapat lewat)──▶ siap_diputuskan
siap_diputuskan ──(SM)──▶ disetujui | uji_coba(sampai tgl, 2–4 minggu) | ditolak | ditunda
ditunda ──(data dilengkapi)──▶ siap_diputuskan
disetujui | uji_coba ──(PM terbitkan versi yang menautkannya)──▶ berlaku
uji_coba (tanggal akhir tiba) ──(SM)──▶ berlaku (permanen) | dicabut | diganti (tautan ke usulan baru)
```

**Cek dampak**
- Satu baris per divisi terdampak.
- Nilainya: `tidak_berdampak`, `perlu_penyesuaian`, atau `bertentangan`. Dua nilai terakhir wajib disertai alasan.
- **Tenggat cek dampak:**
  - Tenggatnya **pukul 18.00 pada hari kerja terakhir sebelum rapat mingguan sasaran**.
  - **Rapat sasaran** adalah rapat mingguan pertama yang tenggatnya jatuh minimal 1 hari kerja setelah usulan diteruskan.
  - Contoh: usulan yang diteruskan Jumat siang tidak masuk rapat Senin, tetapi rapat Senin berikutnya.
- Divisi yang belum mengisi saat tenggat lewat tercatat "tidak mengisi" dan tetap ditampilkan di rapat.
- **Ukuran "paling lama 7 hari" (KPI SM1):** usulan tepat waktu bila diputuskan paling lambat di hari rapat sasarannya. Dengan cara ini, Studio Manager tidak dihukum karena jadwal rapat mingguan. Usulan yang diajukan hari Jumat bisa membutuhkan sampai 10 hari kalender.

**Keputusan**
- Hanya Studio Manager yang bisa memutuskan, lewat RPC.
- Alasan wajib diisi.
- Rapat tempat keputusan diambil ikut dicatat bila tersedia.

**Jalur darurat**
- Studio Manager mengisi "Berlaku sejak", dan status langsung menjadi `berlaku_darurat`.
- **Peringatan "terlambat dicatat"**: muncul bila `dibuat_pada − berlaku_sejak > 24 jam`. Data ini masuk KPI SM3.
- **Gugur otomatis**: `pg_cron` mengubah status usulan menjadi `gugur` bila usulan belum diputuskan sampai pukul 23.59 WIB pada hari rapat mingguan pertama yang dimulai minimal 1 hari kerja setelah `berlaku_sejak`.
- **Kuota**:
  - Penghitung "Darurat bulan ini: n/2" tampil di formulir.
  - Usulan ke-3 tetap bisa disimpan, tetapi ditandai "melebihi batas", lalu otomatis masuk agenda Review Bulanan.

**Jalur internal**
- Usulan berstatus `masa_keberatan` selama 3 hari kerja, lalu otomatis `berlaku`.
- Anggota management dari divisi lain, maupun PM, dapat menekan "Keberatan" dengan alasan. Usulan lalu pindah ke jalur biasa dengan status `cek_dampak`.

**Pencatatan dan pemantauan**
- Setiap perubahan status ditulis ke `audit_log`.
- Tampilan daftar dapat difilter menurut status, jalur, divisi, dan bulan.
- Penghitung "umur usulan" ditandai merah bila sudah lebih dari 7 hari dan belum diputuskan.

**Kriteria terima**
- Transisi status hanya terjadi lewat RPC. Transisi yang tidak sah ditolak dengan pesan berbahasa Indonesia.
- Leader tidak bisa mengisi cek dampak untuk divisi lain.
- Fungsi gugur otomatis bersifat idempoten dan tidak menyentuh usulan yang sudah diputuskan.

### P2a — Serah Terima lintas divisi

**Cerita pengguna:** sebagai PM, saya melihat semua serah terima antardivisi beserta tenggatnya. Yang terlambat otomatis berwarna merah.

**Jenis serah terima**
- Tenggat dihitung dalam **hari kerja**: Senin–Jumat, 09.00–18.00 WIB, tidak termasuk tanggal di `hari_libur` yang `libur = true`.
- 1 hari kerja = 9 jam kerja.

| Jenis | Penanggung jawab SLA | Mulai | Tenggat | Selesai saat |
|---|---|---|---|---|
| `calon_klien` | Leader Sosmed | Waktu calon klien masuk (diisi) | +1 hari kerja | Ditandai "diteruskan ke Dea" |
| `kartu_proyek` | Leader Service | Waktu Dea meneruskan (diisi) | +1 hari kerja | Tautan kartu Daily Task (CLIENT WORK) diisi |
| `review_dea` | Dea (dipantau PM) | Pengajuan konsep atau final | +1 hari kerja | Keputusan Dea dicatat: disetujui atau revisi |
| `portofolio` | Leader Service | Tanggal serah terima ke klien (diisi) | +3 hari kerja | Kartu dikirim ke Sosmed |
| `info_rilis` | Leader Marketplace | — | Tanggal rilis − 3 hari, pukul 18.00 | Kartu dikirim ke Sosmed |
| `qc_studio_project` | Leader Marketplace | Hasil diserahkan Service | +2 hari kerja | QC ditandai selesai (lolos atau tidak) |
| `kalender_bulanan` | Leader Sosmed / Leader Marketplace | — | Tanggal 25, pukul 18.00 | Kalender atau jadwal rilis diajukan |
| `lainnya` | Dipilih pembuat | Diisi | Diisi | Ditandai selesai |

**Aturan**
- **Waktu "mulai" yang diisi manual:**
  - Tidak boleh di masa depan, dan tidak boleh lebih dari 7 hari ke belakang.
  - Perubahan setelah kartu dibuat hanya bisa dilakukan oleh PM, dengan alasan, dan tercatat di audit.
- **Tautan Daily Task:** setiap kartu dapat diberi tautan ke item Daily Task (id item). Tidak ada sinkronisasi dua arah.
- **Warna kartu:**

  | Kondisi | Warna |
  |---|---|
  | Sisa waktu kurang dari 25% durasi | Kuning |
  | Tenggat lewat | Merah |

- **Tindak lanjut PM:**
  - Pada kartu merah, PM menekan **"Sudah ditindaklanjuti"** disertai catatan. Data ini masuk KPI PM2.
  - Batas waktu tindak lanjut untuk PM2:

    | Tenggat lewat | Batas tindak lanjut |
    |---|---|
    | Sebelum pukul 15.00 di hari kerja | Pukul 18.00 hari yang sama |
    | Setelah pukul 15.00, atau di luar jam kerja | Pukul 12.00 hari kerja berikutnya |
  - Kartu merah yang belum ditindaklanjuti tampil di panel "Perlu tindakan" milik PM dan otomatis masuk agenda rapat.
- **Tampilan:**
  - Papan berkolom "Berjalan · Terlambat · Selesai minggu ini".
  - Filter menurut divisi dan jenis.
  - Ringkasan ketepatan per divisi untuk bulan berjalan.

**Kriteria terima**
- Perhitungan tenggat untuk lintas akhir pekan, hari libur, dan di luar jam kerja **sama persis** antara SQL dan `lib/management/hariKerja.ts`. Keduanya diuji dengan kasus yang sama.
- Kartu `info_rilis` yang dibuat setelah lewat H-3 langsung tercatat terlambat.

### P2b — Ringkasan Harian

**Aturan**
- **Isian:**
  - Satu ringkasan per leader per hari kerja, berisi "Selesai", "Hambatan", dan "Butuh bantuan dari" (pilih divisi, boleh kosong).
  - Setiap isian dibatasi 280 karakter, dan maksimal 3 butir.
- **Batas waktu:**
  - Ringkasan tepat waktu bila dikirim sebelum pukul 18.00 WIB.
  - Ringkasan boleh disunting sampai pukul 23.59. Waktu kirim pertama yang dihitung.
- **Hari yang tidak dihitung:** hari ketika leader berstatus cuti/izin/sakit yang **Disetujui** di `approvals`, dan hari libur.
- **Hambatan lintas divisi:** isian "Butuh bantuan dari" otomatis muncul di panel PM dan di panel leader divisi tujuan.
- **Tampilan:**
  - Linimasa per hari untuk ketiga leader.
  - Studio Manager dan owner membacanya di tab Ringkasan.

### P3 — Rapat

**Jenis rapat**
- `mingguan`
- `bulanan`
- `sinkron_owner`
- `pengesahan`
- `dadakan`: wajib punya agenda sebelum waktu mulai.

**Agenda**
- **Isi otomatis** saat PM membuat rapat mingguan:
  - ringkasan KPI per divisi;
  - serah terima merah;
  - usulan `siap_diputuskan`;
  - aturan darurat yang perlu disahkan;
  - item Bank Ide yang menunggu prioritas (P5).
- PM dapat menyunting agenda, lalu menekan **Bagikan**. Waktu bagikan dicatat untuk KPI PM3: tepat waktu bila sebelum Jumat 17.00 untuk rapat Senin.

**Notulen dan keputusan**
- Notulen berformat Markdown.
- Setiap keputusan ditulis sebagai baris **Tugas**, berisi judul, penanggung jawab (anggota management), tenggat, dan status.
- Waktu unggah notulen dicatat. Tepat waktu bila paling lambat 24 jam setelah rapat dimulai.
- Usulan yang diputuskan di rapat tercatat dengan `rapat_id`.

**Kehadiran:** dicatat per peserta. Data ini dipakai untuk KPI SM5, SM6, dan indikator "rapat terlaksana".

**Tugas rapat**
- Tugas rapat tampil di "Perlu tindakan saya" milik penanggung jawabnya.
- Tugas dihitung selesai tepat waktu bila ditandai selesai sebelum tenggat (KPI PM6).

### P4 — KPI

**Definisi**
- Tabel `mgmt_kpi_definisi` berisi 37 baris KPI dari Pedoman Bagian 5 (kode SV1–HR6), lengkap dengan bobot, target, jenis target, sumber, dan cara agregasi.
- Definisi tertaut ke versi Pedoman. Perubahan target hanya terjadi lewat usulan, lalu versi baru Pedoman.

**Jenis target**
- `min_persen`
- `min_nilai`
- `maks_jumlah` (berbatas atas)
- `baseline_plus` (baseline × 1,10)
- `min_baseline`

**Cara agregasi bulanan untuk isian manual**

| Agregasi | Cara | Contoh KPI |
|---|---|---|
| `rasio` | Σ pembilang ÷ Σ penyebut | SV1, SV2, SV3, SV4, MS1, MP1, MP4 |
| `jumlah` | Jumlah | MS2 reach, MP2 pendapatan |
| `rata2` | Rata-rata | MS3 engagement rate |
| `terakhir` | Nilai terakhir di bulan itu | MP3 rating |

**Sumber data per KPI**

| Otomatis | Diisi (Jumat, dengan tautan bukti) |
|---|---|
| SV5, SV6, MS4 (setelah P5 Calon Klien; sebelum itu diisi), MS5 (kecuali komponen "promo rilis tepat hari"), MS6, MP5 (kecuali komponen "pesan pembeli"), MP6, SM1–SM6, PM1–PM7, HR1 (setelah P5 Kepatuhan Jalur), HR3, HR4 (setelah kolom waktu `approvals`), HR5 (komponen konfirmasi baca Pedoman) | SV1–SV4, MS1–MS3, MP1–MP4, komponen manual MS5 dan MP5, HR2, HR6, komponen manual HR5 |

**KPI komposit** (MS5, MP5, HR5): skornya adalah rata-rata kepatuhan dari setiap komponen. Setiap komponen punya sumber sendiri.

**Sumber otomatis yang belum terpasang:** selama fitur sumbernya belum ada, KPI otomatis diisi manual oleh pemiliknya dengan tautan bukti. Contoh: SM4 menunggu Kepatuhan Jalur di P5, SM5 dan SM6 menunggu Rapat di P3 dan 1-on-1 di P5. Formulir KPI menampilkan label "Diisi manual sampai [fitur] terpasang".

**Kolom waktu baru untuk HR4**
- `approvals."diajukanPada" timestamptz default now()`.
- `approvals."diputuskanPada" timestamptz`, diisi oleh trigger saat `status` berubah dari Menunggu.
- Baris lama yang kolomnya kosong dikeluarkan dari perhitungan.

**Rumus skor** (fungsi murni `lib/management/skorKpi.ts`, dicerminkan di SQL bila dihitung server)
- Skor per KPI = `min(capaian / target, 1) × bobot` untuk jenis min/baseline.
- `maks_jumlah`: skornya `bobot` bila `capaian ≤ target`, dan 0 bila tidak.
- KPI tanpa data di periode itu dikeluarkan, dan bobotnya dibagi proporsional ke KPI lain.
- **Baseline:**
  - Baseline bulan M = rata-rata bulan M-1, M-2, dan M-3 yang tersedia.
  - Bila belum ada data, dipakai baseline awal yang dikunci PM pada 11 Jan 2027. Penguncian disertai bukti dan tercatat di audit.
- **Kategori:**

  | Skor | Kategori |
  |---|---|
  | ≥ 90 | Sangat baik |
  | 75–89 | Baik |
  | 60–74 | Perlu perbaikan |
  | < 60 | Rencana perbaikan |

- **Periode kalibrasi:** skor periode sebelum 1 Feb 2027 diberi label **"Kalibrasi — tidak dipakai untuk penilaian"**.

**Tampilan**
- **Formulir "Laporan Mingguan"** per peran.
  - Tepat waktu bila dikirim sebelum Jumat 16.00 (bagian dari KPI SV6/MS6/MP6).
- **Kartu skor bulanan per orang**, berisi rincian per KPI, tren 3 bulan, dan kategori.
- **Dasbor management:**
  - skor keenam peran;
  - ketepatan serah terima per divisi;
  - umur usulan;
  - status baca Pedoman.
- **Laporan bulanan**
  - Dibuat otomatis, lalu PM menekan **Terbitkan** (KPI PM7: sebelum H-1 Review Bulanan). Ekspor PDF memakai jspdf yang sudah ada.
  - HR mengisi bagian "Rekap HR" sebelum laporan diterbitkan (KPI HR3).

### P5 — Lainnya

| Fitur | Isi | Siapa |
|---|---|---|
| **Bank Ide Studio Project** | Judul, sumber divisi, alasan/data (tautan), status (`baru → diprioritaskan → dikerjakan → selesai / ditolak`), prioritas oleh PM di rapat, tautan item Daily Task (STUDIO PROJECT). Penghitung "ide minggu ini" untuk Marketplace (komponen MP5, minimal 3) | Semua anggota mengusulkan; PM memprioritaskan |
| **Kalender bersama** | Entri konten (Sosmed) dan rilis (Marketplace): tanggal, judul, status `rencana → tayang/rilis → batal`. Tampilan bulan. Tombol "Ajukan kalender bulan depan" membuat serah terima `kalender_bulanan` selesai. Status "disahkan" diisi dari rapat | Leader Sosmed, Leader Marketplace; PM menggabungkan |
| **Daftar Calon Klien** | Nama/brand, kanal (DM, marketplace, referral, lainnya), ringkasan kebutuhan, waktu masuk, status `baru → diteruskan ke Dea → jadi proyek → tidak lanjut`. Otomatis membuat serah terima `calon_klien`. **Tanpa nomor telepon atau email klien** (data minimum) | Leader Sosmed, Leader Service, owner |
| **Kepatuhan Jalur** | Catatan instruksi atau aturan di luar jalur: tanggal, pihak (peran), uraian, tindak lanjut. **Tidak bisa diubah atau dihapus setelah 24 jam.** Pelapor hanya terlihat oleh owner dan HR. Owner dapat menandai "tidak valid" dengan alasan. Dipakai KPI SM4 dan HR1 | Semua anggota mencatat |
| **Catatan 1-on-1** | Tanggal, catatan, tindak lanjut. Hanya dapat dibaca kedua pihak. Kehadiran (bukan isinya) dihitung untuk KPI SM5 | Studio Manager dengan anggota |

### Ringkasan dan "Perlu tindakan saya" (dibangun bertahap sejak P1)

Panel ini dihitung di klien dari data yang sudah dimuat. Isinya per peran:

| Peran | Isi panel |
|---|---|
| Leader | Cek dampak yang menunggu, serah terima masuk, Ringkasan Harian hari ini, Laporan Mingguan (Jumat), tugas rapat |
| PM | Usulan baru untuk diteruskan, kartu merah, agenda Jumat, notulen yang belum diunggah, versi Pedoman yang perlu diterbitkan (ada usulan `disetujui` lebih dari 1 hari kerja) |
| Studio Manager | Usulan `siap_diputuskan`, darurat yang menunggu pengesahan, eskalasi |
| Owner | Daftar `review_dea` yang menunggu, ringkasan KPI |

## Model data (Supabase, skema `public`, semua ber-RLS)

| Tabel | Kolom utama |
|---|---|
| `mgmt_anggota` | `id`, `user_id uuid null`, `email text`, `nama text`, `peran text check (peran in ('studio_manager','pm','hr','leader_sosmed','leader_service','leader_marketplace','owner'))`, `divisi text null` (sosmed/service/marketplace, untuk leader), `aktif bool default true`, `dibuat_pada`, `dibuat_oleh` |
| `mgmt_divisi_staf` | `id_karyawan text` (`employees.idKaryawan`), `divisi text` (sosmed/service/marketplace/lainnya), `diubah_oleh`, `diubah_pada`. Diisi HR di Pedoman › Status baca; dipakai untuk status baca per divisi dan pengingat ke leader |
| `mgmt_pedoman_versi` | `id`, `versi text unique` (v1.0), `isi_md text`, `ringkasan_perubahan text`, `status text` (draf/berlaku/arsip), `berlaku_mulai date`, `pengesahan_awal bool`, `diterbitkan_oleh`, `diterbitkan_pada`, `dibuat_pada` |
| `mgmt_pedoman_usulan` | `versi_id`, `usulan_id` (tautan banyak-ke-banyak) |
| `mgmt_pedoman_baca` | `versi_id`, `user_id`, `dibaca_pada`; unique (`versi_id`, `user_id`) |
| `mgmt_usulan` | `id`, `nomor text unique`, `judul`, `masalah`, `perubahan`, `bagian_pedoman`, `divisi_terdampak text[]`, `sumber`, `jalur` (biasa/darurat/internal), `status`, `pengusul_id`, `atas_nama_owner bool`, `berlaku_sejak timestamptz null`, `diteruskan_pada`, `tenggat_dampak timestamptz`, `keputusan_alasan`, `diputuskan_oleh`, `diputuskan_pada`, `rapat_id null`, `uji_coba_sampai date null`, `pengganti_id null`, `dibuat_pada` |
| `mgmt_usulan_dampak` | `usulan_id`, `divisi`, `nilai` (tidak_berdampak/perlu_penyesuaian/bertentangan/tidak_mengisi), `alasan`, `diisi_oleh`, `diisi_pada`; unique (`usulan_id`, `divisi`) |
| `mgmt_usulan_keberatan` | `usulan_id`, `oleh`, `alasan`, `dibuat_pada` |
| `mgmt_serah_terima` | `id`, `jenis`, `dari_divisi`, `ke_divisi`, `penanggung_jawab_peran`, `judul`, `catatan`, `mulai timestamptz null`, `tanggal_rilis date null`, `tenggat timestamptz`, `status` (berjalan/selesai/batal), `selesai_pada`, `hasil text null` (lolos/tidak, disetujui/revisi), `tautan_item text null`, `ditindaklanjuti_pada`, `catatan_tindak_lanjut`, `dibuat_oleh`, `dibuat_pada` |
| `mgmt_ringkasan_harian` | `id`, `user_id`, `divisi`, `tanggal date`, `selesai text[]`, `hambatan text[]`, `butuh_divisi text null`, `dikirim_pertama_pada`, `diubah_pada`; unique (`user_id`, `tanggal`) |
| `mgmt_rapat` | `id`, `jenis`, `mulai timestamptz`, `agenda_md`, `agenda_dibagikan_pada`, `notulen_md`, `notulen_diunggah_pada`, `dipimpin_oleh` |
| `mgmt_rapat_hadir` | `rapat_id`, `user_id`, `hadir bool` |
| `mgmt_tugas` | `id`, `rapat_id`, `judul`, `pic_id`, `tenggat date`, `status` (terbuka/selesai/batal), `selesai_pada` |
| `mgmt_kpi_definisi` | `kode text`, `peran`, `nama`, `bobot numeric`, `target numeric`, `jenis_target`, `agregasi`, `sumber` (otomatis/manual/komposit), `komponen jsonb null`, `versi_id`, `urutan`; unique (`kode`, `versi_id`) |
| `mgmt_kpi_isian` | `id`, `kode`, `user_id`, `minggu_mulai date`, `pembilang numeric null`, `penyebut numeric null`, `nilai numeric null`, `bukti_url text`, `diisi_pada`; unique (`kode`, `user_id`, `minggu_mulai`) |
| `mgmt_kpi_baseline` | `kode`, `user_id`, `nilai`, `dikunci_pada`, `dikunci_oleh`, `bukti_url` |
| `mgmt_laporan_bulanan` | `bulan date unique`, `rekap_hr_md`, `rekap_hr_diisi_pada`, `diterbitkan_pada`, `diterbitkan_oleh`, `snapshot jsonb` (skor saat terbit) |
| P5 | `mgmt_bank_ide`, `mgmt_kalender`, `mgmt_calon_klien`, `mgmt_kepatuhan_jalur`, `mgmt_satu_satu`: kolom sesuai tabel P5 di atas |

Perubahan pada tabel lama:
- `approvals`: tambah dua kolom waktu (P4), beserta triggernya.
- `pengaturan`: kunci baru `mgmt_hari_rapat` (bawaan `1` = Senin), `mgmt_jam_rapat` (`10:00`), dan `mgmt_mulai_penilaian` (`2027-02-01`).

## RLS dan RPC

**Fungsi penentu akses** (`stable`, `security definer`, memakai pola pencocokan `baris_saya()`):
- `adalah_management()`
- `peran_management()`, mengembalikan `text[]`
- `divisi_saya()`

**Hak baca**

| Data | Siapa boleh membaca |
|---|---|
| `mgmt_pedoman_versi` berstatus berlaku/arsip | Semua `authenticated` |
| `mgmt_pedoman_versi` berstatus draf | Management |
| `mgmt_pedoman_baca` | Baris milik sendiri. Management membaca semua; leader hanya divisinya |
| Tabel `mgmt_*` lain | Management |
| `mgmt_satu_satu` | Kedua pihak saja |
| Kolom pelapor di `mgmt_kepatuhan_jalur` | Owner dan HR, lewat view `mgmt_kepatuhan_jalur_v` yang mengosongkan kolom pelapor untuk peran lain |

**Penulisan dan transisi**
- Semua transisi status dan penulisan sensitif dilakukan **lewat RPC** `security definer`. Tabel tidak menerima UPDATE langsung untuk kolom status.
- Setiap RPC memeriksa peran dan transisi yang sah, lalu menulis ke `audit_log`.

| RPC | Fungsi |
|---|---|
| `mgmt_ajukan_usulan` | Mencatat usulan baru |
| `mgmt_teruskan_usulan` | Meneruskan usulan ke cek dampak |
| `mgmt_isi_dampak` | Mengisi penilaian dampak |
| `mgmt_putuskan_usulan` | Mencatat keputusan Studio Manager |
| `mgmt_keberatan` | Mengajukan keberatan atas usulan internal |
| `mgmt_terbitkan_pedoman` | Menerbitkan versi Pedoman baru |
| `mgmt_selesaikan_serah_terima` | Menandai serah terima selesai |
| `mgmt_tindaklanjuti` | Mencatat tindak lanjut PM atas kartu merah |
| `mgmt_ubah_mulai` | Mengubah waktu mulai serah terima (PM) |
| `mgmt_kirim_ringkasan` | Mengirim Ringkasan Harian |
| `mgmt_bagikan_agenda` | Membagikan agenda rapat |
| `mgmt_unggah_notulen` | Mengunggah notulen |
| `mgmt_kunci_baseline` | Mengunci baseline awal |
| `mgmt_terbitkan_laporan` | Menerbitkan laporan bulanan |
| `mgmt_atur_anggota` | Mengelola daftar anggota |

**Pagar dan jadwal**
- Pagar `pagar_akses_login` (RESTRICTIVE) yang sudah ada **otomatis** dipasang di tabel baru. Caranya: menjalankan ulang loop dari `akses-login.sql`, atau menambahkan kebijakan yang sama secara eksplisit.
- Jadwal `pg_cron`:
  - `mgmt_gugurkan_darurat()` setiap hari pukul 23.59 WIB;
  - `mgmt_tutup_masa_keberatan()` dan `mgmt_tandai_dampak_tidak_mengisi()` setiap jam pada hari kerja.
- Ketiga fungsi bersifat idempoten.

## Pengingat

**Panel di aplikasi:** "Perlu tindakan saya" menjadi sumber utama dan selalu tersedia.

**Push**
- Rute baru `/api/management/pengingat` dipanggil Vercel Cron.
  - Selalu berjalan pukul 08.30 WIB pada hari kerja, berupa ringkasan pagi per orang.
  - Bila paket Vercel mengizinkan, juga setiap jam pada 10.00–17.00 untuk tenggat yang jatuh di jam berikutnya.
- Rute memverifikasi `CRON_SECRET` dan memakai `/api/push/send` yang sudah ada.

**Pengingat tetap**

| Waktu | Pengingat |
|---|---|
| Jumat 15.00 | Laporan Mingguan untuk leader |
| Jumat 16.00 | Agenda rapat untuk PM |
| H-1 rapat, 15.00 | Cek dampak |
| Pukul 17.00 | Ringkasan Harian yang belum dikirim |
| Setiap tanggal 25 | Kalender dan jadwal rilis |

**WhatsApp:** di luar cakupan P1–P4, karena `/api/wa` adalah siaran khusus admin.

## Tampilan

- **Tema dan perangkat:**
  - Mengikuti tema **Gelap** dan **Neo-Brutal** yang sudah ada.
  - Responsif ponsel; tab menjadi gulir horizontal di ponsel.
- **Bahasa:**
  - Mengikuti `glosarium-istilah.md`.
  - Tanggal ditampilkan dengan `teksTanggal`, misalnya "Sen, 7 Des 2026".
- **Pesan kosong** selalu menyebut apa yang akan muncul dan satu aksi. Contoh: "Belum ada usulan. — Ajukan usulan".
- **Aksesibilitas:**
  - Dialog memakai `useJebakFokus`.
  - Status tidak hanya dibedakan dengan warna, tetapi juga dengan label "Terlambat", "Hampir tenggat", dan seterusnya.

## Pemasangan

Mengikuti pola fitur sebelumnya:
1. **Kode dipasang dulu.** Kode ini aman dipasang sebelum SQL: tanpa tabel, menu dan banner tersembunyi.
2. **SQL dijalankan per prioritas:** `management-p1.sql` dan seterusnya.
   - Satu transaksi.
   - Idempoten.
   - `lock_timeout 10s`.
   - Ada bagian darurat untuk melepas jadwal cron dan menyembunyikan menu.
3. **Siapa yang menjalankan SQL:** pengguna sendiri, atau Claude lewat koneksi Supabase **hanya setelah pengguna bilang "jalankan"**. Setelah itu dilakukan verifikasi dengan kueri baca saja.
4. **Data awal P1:**
   - 7 baris `mgmt_anggota`, diisi HR/Studio Manager lewat menu, bukan lewat SQL.
   - Pedoman v1.0 dari dokumen yang disahkan pada 4 Des 2026, dengan "Pengesahan awal".
   - 37 baris `mgmt_kpi_definisi`.
5. **Migrasi dari sheet sementara:** impor CSV untuk usulan dan serah terima, dengan `papaparse` yang sudah ada. Dilakukan sekali saat P1–P2 terpasang.

## Pengujian

- **SQL** di Postgres lokal dengan tiruan Supabase:
  - setiap transisi sah dan tidak sah;
  - peran per RPC;
  - RLS per peran, termasuk karyawan non-management yang hanya membaca Pedoman;
  - gugur otomatis;
  - masa keberatan;
  - idempotensi (dijalankan 2×).
- **Unit:**
  - `hariKerja.ts` (tenggat lintas akhir pekan, libur, dan jam 18.00), sama persis dengan SQL;
  - `skorKpi.ts` (semua jenis target, redistribusi bobot, baseline, label kalibrasi);
  - nomor usulan.
- **e2e (mock):**
  - menu tampil dan tersembunyi sesuai peran;
  - banner wajib baca;
  - alur usulan biasa, darurat, dan internal;
  - kartu merah dan tindak lanjut;
  - Ringkasan Harian;
  - agenda otomatis;
  - formulir KPI;
  - ditambah regresi untuk suite yang sudah ada.
- **Pemeriksaan kode:**
  - tsc dan lint sama dengan baseline;
  - A/B piksel tema gelap untuk halaman yang sudah ada (harus identik bila tabel belum dipasang).
- **Tinjauan independen** sebelum dikirim.

## Rilis bertahap

| Tahap | Isi | Target |
|---|---|---|
| P1 | Anggota, Pedoman (wajib baca), Log Usulan, panel "Perlu tindakan" dasar | Sebelum 7 Des 2026 bila memungkinkan; paling lambat 15 Jan 2027 |
| P2 | Serah Terima, Ringkasan Harian | Sebelum 1 Feb 2027 |
| P3 | Rapat dan tugas | Februari 2027 |
| P4 | KPI dan laporan bulanan, kolom waktu `approvals` | Sebelum Review Bulanan Maret 2027 |
| P5 | Bank Ide, Kalender, Calon Klien, Kepatuhan Jalur, 1-on-1 | Setelah P4 |

Selama tahap belum terpasang, bagian yang bersangkutan berjalan di sheet sementara.

## Di luar cakupan

- Integrasi API Instagram, TikTok, Canva, atau Adobe Express. Angka dari platform tersebut diisi manual dengan bukti.
- Sinkronisasi dua arah dengan Daily Task. Yang tersedia hanya tautan item.
- WhatsApp otomatis.
- Mengubah peran `members.role` (manager/member) di Daily Task.
- Penilaian kinerja staf non-management. Modul `performance_reviews` yang sudah ada tidak diubah.
- Daftar harga dan paket revisi.
