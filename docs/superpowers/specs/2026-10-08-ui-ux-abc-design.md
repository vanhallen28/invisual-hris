# Pembenahan UI/UX HRIS — Kelompok A, B, C (rancangan)

Tanggal: 8 Oktober 2026 · Dasar: audit UI/UX 18 halaman (artefak "Audit UI/UX HRIS Invisual", ringkasan di `claude/audit-ui-ux.md`).

## Tujuan

Menutup 17 temuan audit **tanpa mengubah logika bisnis** (absensi, lembur, payroll, pengajuan, chat, tracker). Semua perubahan bersifat tampilan, navigasi, salinan teks, dan aksesibilitas. Setiap kelompok dikirim sebagai ZIP kumulatif (`ui-ux-a.zip` → `ui-ux-ab.zip` → `ui-ux-abc.zip`) sehingga bisa dipasang bertahap.

## Prinsip

1. **Aditif & token-first.** Perbaikan global dilakukan di `globals.css` (token Tailwind v4) agar satu perubahan berlaku ke seluruh aplikasi; komponen disentuh hanya bila perlu.
2. **Pengait uji tetap.** Label tombol dan atribut yang dipakai e2e (`CLOCK IN`, `CLOCK OUT`, `Absen Sekarang`, `[title="Lihat daftar …"]`, `Tutup Jendela`, `data-*`) tidak diubah.
3. **Tidak menyentuh modul Tracker, Chat, Kanvas** kecuali untuk token global (kontras) — modul itu punya kerapatan UI sendiri; ukuran huruf di sana tidak di-codemod.
4. **Koreksi audit:** `prefers-reduced-motion` ternyata sudah ada secara global (globals.css baris 258). Temuan 5 dipersempit ke fokus keyboard & focus-trap.

## Kelompok A — cepat & aditif

| # | Temuan | Perubahan |
|---|--------|-----------|
| A1 | 5 menu HR tak terjangkau di ponsel | Nav bawah admin menjadi 5 tujuan: Dasbor · Kehadiran · Karyawan · Chat · **Lainnya**. "Lainnya" membuka lembar bawah (bottom sheet) berisi Payroll, Daily Task, Corporate Vault, Keuangan, Log Aktivitas, Pengaturan. "Lainnya" aktif bila halaman saat ini ada di dalamnya. Escape/ketuk latar menutup. |
| A2 | Teks mini & kontras | (a) Token: `--color-gray-500` → `#868ea2` (≈5,5:1 di kartu), `--color-gray-600` → `#767f94` (≈4,5:1). (b) Kelas `.permukaan-terang` mengembalikan abu-abu bawaan untuk permukaan putih (slip gaji, pratinjau berkas). (c) Codemod ukuran huruf di `src/app/**`, `src/components/{admin,kehadiran,keuangan,corporate,payroll}/`, `src/components/*.tsx`: `text-[7–9px]` → `text-[10px]`, `text-[10px]` → `text-[11px]`; varian `md:` disamakan agar tidak lebih kecil dari ukuran dasar; subjudul identitas header ("Human Resource … System") dikecualikan. (d) Teks `text-primer-terang` (3,15:1) → `text-tint`; catatan kaki login `text-gray-700` → `text-gray-500`. |
| A3 | Login menyembunyikan form | Gerbang logo tetap, tetapi **terbuka otomatis** setelah animasi logo selesai (~1,6 dtk), atau segera saat ada ketukan/tombol apa pun; `prefers-reduced-motion` → langsung terbuka. Petunjuk "Ketuk untuk masuk" dinaikkan ke 12 px/opasitas 0,65. Fokus otomatis ke kolom email saat terbuka. |
| A4 | Modal "Anomali Terdeteksi!" tiap buka dasbor | Popup penghalang dihapus. Banner merah diganti **panel amber "Perlu dilengkapi"** dengan salinan jujur: "N data karyawan belum lengkap · M keterlambatan belum ditinjau", tombol "Tinjau" membuka modal rinci yang sudah ada, tombol "Sembunyikan hari ini" (sessionStorage). Daftar/aksi anomali tidak berubah. |
| A5 | Tanggal ISO | `src/lib/tanggalTampil.ts`: `teksTanggal("2026-10-08")` → "Kam, 8 Okt 2026"; menangani rentang "A s/d B" dan embel-embel "(Est. Sampai: …)". Diterapkan pada dasbor HR (antrean, keterlambatan, rincian), dasbor & kehadiran karyawan, kehadiran HR (daftar rincian), detail karyawan, pengingat kontrak, chip kompensasi. Data tetap ISO. |
| A6 | Toast menumpuk | Maksimal 2 toast tampil (yang lebih lama dibuang), klik untuk menutup, `role="status"` + `aria-live="polite"`, tombol tutup eksplisit. |
| A7 | Fokus keyboard | `:focus-visible` global (cincin `--color-tint`, offset 2 px) untuk tombol, tautan, input, `[role=button]`, `[tabindex]`. Hook `useJebakFokus(ref, aktif, onTutup)` (Tab berputar di dalam, Escape menutup, fokus kembali ke pemicu) dipasang pada modal keluar (kedua layout), dialog konfirmasi Toast, lembar "Lainnya". Tautan "Lewati ke konten" di kedua layout. |

## Kelompok B — struktural

| # | Temuan | Perubahan |
|---|--------|-----------|
| B10a | Tabel Karyawan longgar, hapus berdampingan | Padding sel `px-6 py-5` → `px-4 py-3.5`; nama `text-base` → `text-sm`; kolom Tindakan: Ubah dan Hapus dipisah garis vertikal, Hapus bergaya merah redup dengan label `aria-label`. |
| B10b | Tabel Payroll sesak | Nama & tombol `whitespace-nowrap`; tombol aksi jadi ikon + label pendek ("Gaji", "Slip", "PDF", "Kirim"); `min-w` 1040 → 980. |
| B13 | Hierarki dasbor HR | Empat ubin KPI duplikat dihapus; "Butuh persetujuan" naik ke baris pertama di samping cincin kehadiran (`lg:col-span-2 lg:row-span-2`). "Pusat Aksi Cepat Eksekutif" diubah menjadi baris tombol kecil di header ("Aksi ▾" di ponsel) — fungsi (Export CSV, Email Blast, WhatsApp Blast, Kirim Slip Gaji, Backup DB) tetap. |
| B9 | Terminal Absensi ganda | Tidak digabung (logika absen dipakai dua halaman & diuji e2e). Peran diperjelas: judul terminal di Dasbor "Absen cepat" + tautan "Riwayat & pengajuan →" ke halaman Absen; halaman Absen tetap lengkap. **Bonus:** kartu ringkasan Hadir/Terlambat/Sakit di halaman Absen karyawan yang selama ini **angka tetap (22/1/0)** diganti hitungan nyata dari periode gaji berjalan (`periodeGaji`). |
| B12 | Empty state & loading | Setiap keadaan kosong punya penjelasan + aksi: Karyawan ("Hapus filter"), Payroll ("Sinkronkan karyawan"), pengajuan karyawan ("Ajukan izin/cuti"), tugas ("Buka Daily Task"). Spinner layar penuh di Karyawan diganti kerangka (skeleton) tabel 4 baris. |
| B14 | Detail karyawan | Tab dalam "Personal / Kepegawaian" dihapus; "Kepegawaian" jadi item menu samping sendiri. `InfoRow` menampilkan "Belum diisi" (abu, miring) alih-alih "-", nilai tebakan ("Tidak Diketahui", "WNI (Indonesia)") diganti "Belum diisi". Tombol "Ekspor Detail" yang tak berfungsi disembunyikan. |
| B16 | Sidebar tanpa grup, Keuangan tanpa akses | Sidebar admin dikelompokkan: **Operasional** (Dasbor, Kehadiran, Karyawan, Payroll) · **Kolaborasi** (Daily Task, Chat, Corporate Vault) · **Perusahaan** (Keuangan, Log Aktivitas). Keuangan diberi ikon gembok + `title` bila `ambilPeran()` mengembalikan null (menu tetap tampil agar bisa minta akses). |
| B6 | Istilah | Glosarium (`docs/glosarium-istilah.md`): Clock In / Clock Out (istilah tetap, kapitalisasi seragam), Dasbor, Kehadiran (HR) / Absen (karyawan), Pengajuan, Izin Terlambat, WFH/WFC. Perbaikan salinan: "Panel Kontrol HRD" → "Dasbor HR"; "Database Karyawan" → "Karyawan"; "Pusat Deteksi Anomali …" → "Perlu dilengkapi"; "Sistem kecerdasan buatan …" dihapus; "Sembuhkan Data" → "Lengkapi data"; "Manifest Masalah Diagnostik" → "Data yang perlu dilengkapi". |
| B15 | Target sentuh | Tombol ikon kecil (foto, lembur, tutup modal) minimal 32×32 px via kelas `.sentuh` (`min-width/height: 2rem`) — tanpa mengubah ukuran ikon. |

## Kelompok C — tema

| # | Perubahan |
|---|-----------|
| C1 | **Token semantik** di `globals.css`: `--color-teks`, `--color-teks-redup`, `--color-teks-samar`, `--color-garis`, `--color-garis-kuat`, `--color-sukses`, `--color-peringatan`, `--color-bahaya`, `--color-info` → utilitas `text-teks-redup`, `bg-bahaya/10`, dst. Dipakai komponen baru/yang disentuh; komponen lama tetap jalan. |
| C2 | **Mode terang (opsional, beta).** Blok `html[data-tema="terang"]` memetakan ulang token permukaan (`latar`, `input`, `kartu`, `kartu-hover`), skala abu-abu, `tint`, serta `--color-white`/`--color-black` (yang dipakai kode lama sebagai "teks"/"overlay") sehingga `text-white`, `border-white/10`, `bg-white/[0.03]`, `bg-black/80` otomatis menjadi padanan terangnya. Default tetap gelap; `prefers-color-scheme` tidak otomatis. Sakelar di Pengaturan (HR) dan Profil (karyawan), tersimpan di `localStorage['invisual_tema']`, diterapkan sebelum render lewat skrip kecil di `app/layout.tsx` (tanpa kedip). Dua literal `bg-[#000000]` di layout → `bg-latar`; warna literal SVG cincin kehadiran → variabel. Halaman yang masih bermasalah di mode terang didaftar sebagai batasan. |
| C3 | **Ikon seragam.** Emoji di antarmuka HR/karyawan (📸 🌙 ✅ ❌ ★ 📍 🎉 🕒 📞 ✉ 🔓 📝 ⚙️ ⬇ ↻ ⟳ ✓) diganti ikon `lucide-react` 14–16 px dengan `aria-hidden`. Emoji konten chat/tracker (reaksi, sapaan) dibiarkan. |
| C4 | **Skala tipografi.** Kelas utilitas: `.t-label` (11 px, 600, uppercase, tracking 0.08em), `.t-meta` (12 px), `.t-body` (14 px), `.t-title` (16 px/600), `.t-display` (font-display). Dipakai pada komponen yang disentuh di A/B; `tracking-widest` berlebih pada judul kartu dikurangi ke `tracking-wide`. |

## Pengujian

- `npx tsc --noEmit` dibandingkan baseline (`tsc-v7.txt`); `npm run lint` dibandingkan baseline; `npm run build` lulus.
- e2e regresi (mock PostgREST): `absen5`, `dasbor`, `dasbor-panggilan`, `lembur11`, `payroll9`, `kehadiran8`, `online8`; `lembur11` disesuaikan untuk teks tanggal baru pada chip kompensasi.
- `audit-ux.js` dipakai ulang untuk tangkapan 18 halaman × 2 lebar sebelum/sesudah tiap kelompok; pemeriksaan otomatis: `document.documentElement.scrollWidth <= innerWidth` (tak ada gulir mendatar), tidak ada teks < 10 px (kecuali subjudul identitas & SVG), kontras token dihitung ulang.
- Mode terang: tangkapan 18 halaman dengan `data-tema="terang"`; daftar halaman yang belum rapi dicatat.

## Di luar cakupan

Mengubah logika absensi/lembur/payroll; menggabungkan dua terminal absensi; tema neo-brutal; ukuran huruf di Tracker/Chat/Kanvas; mode terang otomatis mengikuti OS.
