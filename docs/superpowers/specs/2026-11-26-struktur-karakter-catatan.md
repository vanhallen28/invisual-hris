# Struktur — karakter karyawan & tata letak rata tengah (26 Nov 2026)

Permintaan:
- Karakter masing-masing orang dipakai di Struktur, **sama persis** dengan tampilan Karyawan dan Absen.
- Isi kartu dan chip staf dibuat rata tengah, termasuk teksnya.

## Yang berubah
- **Karakter = avatar karyawan yang sama** dengan halaman Karyawan & Kehadiran.
  - Memakai komponen `AvatarKaryawan` (sumber `employees.avatarUrl`), dengan urutan thumbnail Cloudinary → URL asli → huruf awal.
  - Kelas avatarnya sama: `rounded-full bg-white/5 border border-white/10 …`. Akibatnya tema gelap dan Neo-Brutal (garis tinta, latar pastel untuk huruf awal) memperlakukannya persis seperti avatar di halaman lain. Hanya ukurannya yang berbeda: 56 px di kartu, 28 px di chip staf, 64 px di kepala laci.
- **Kartu peran** (Owner, Studio Manager, PM, HR, Leader): karakter di atas, lalu label, nama, dan jabatan, semuanya rata tengah.
- **Chip staf**: karakter kecil di kiri, teks rata tengah (juga saat terlipat dua baris). Chip berada di tengah kolom divisi.
- **Label divisi** dan daftar "Belum ditempatkan" juga rata tengah. Mode "Atur penempatan staf" tetap seperti sebelumnya.
- **Laci kanan**: karakter orang yang dipilih tampil di kepala laci.

## Pencocokan orang
- **Staf**: lewat `idKaryawan` yang sudah dikirim `org_struktur()`, cara yang sama dengan Kehadiran.
- **Pemegang posisi management & owner**: `org_struktur()` hanya mengirim nama panggilan, jadi nama → `idKaryawan` dicocokkan lewat view `employees_publik` (kolom `idKaryawan, nama, panggilan`; tanpa data pribadi). Kartu lalu memakai `AvatarKaryawan` dengan ID itu.
- Nama yang dipakai lebih dari satu karyawan diabaikan, sehingga tampil huruf awal dan bukan foto orang lain.
- Owner yang bukan karyawan (Riza, Tryan) tampil dengan huruf awal.
- Gagal memuat data → huruf awal, bagan tetap tampil.
- **Tanpa SQL baru.** Berkas: `src/lib/struktur/karakter.ts` (murni, teruji), `src/components/struktur/Karakter.tsx`, perubahan di `Struktur.tsx` dan `LaciPosisi.tsx`. Tidak ada berkas di luar `struktur/` yang memakainya, jadi halaman lain tidak berubah.

## Pengujian (26 Nov 2026)
- **Unit:** karakter 4/4. Mencakup:
  - panggilan atau nama lengkap;
  - ID angka;
  - nama ganda diabaikan;
  - galat → kosong;
  - kolom yang dibaca terbatas.
- **Lint & tipe:** bersih untuk semua berkas Struktur.
- **Uji tampilan:** 64/64, di tema gelap dan Neo-Brutal, lebar 1440 dan 390. Mencakup:
  - karakter di setiap kartu & chip;
  - huruf awal untuk Riza/Tryan, foto rusak, dan orang tanpa foto;
  - gambar = `avatarUrl` orang yang sama;
  - kelas avatar sama dengan Karyawan/Kehadiran;
  - isi kartu, chip, dan label divisi tepat di tengah (selisih ≤ 1,5 px);
  - warna kartu tetap jalan;
  - karakter di laci;
  - mode atur penempatan;
  - ponsel tanpa gulir samping;
  - tanpa galat JS.

## Cara pasang
Unzip `struktur-karakter.zip` → `npm install && npm run build` → commit & push. Tidak ada SQL.
