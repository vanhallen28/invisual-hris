# Struktur — warna kartu & palet warna (26 Nov 2026)

Permintaan: setiap kartu di Struktur bisa diberi warna, dengan palet warna yang bisa disesuaikan.

## Cara pakai (akun @invisual.studio)
1. Klik kartu (peran atau staf). Di laci kanan ada baris **Warna kartu**: pilih satu warna, atau ⌀ untuk tanpa warna. Pilihan langsung tersimpan.
2. Tombol **Palet warna** (di samping "Atur penempatan staf"), atau tautan "Atur palet" di laci, membuka editor palet:
   - ubah warna lewat pemilih warna atau kode #RRGGBB;
   - beri nama, mis. "Pimpinan" atau "Kreatif";
   - tambah atau hapus warna (maks. 16);
   - kembali ke palet bawaan;
   - lalu **Simpan palet**.
3. Nama warna yang dipakai tampil sebagai **Legenda** di atas bagan, untuk semua yang bisa melihat Struktur.

## Aturan
- **Satu posisi = satu warna.**
  - Owner (Riza & Tryan) berbagi satu posisi, jadi berbagi warna.
  - Staf diwarnai per jabatan di divisinya, mis. semua Graphic Designer di Service. Laci menuliskan cakupannya.
  - Posisi staf yang belum ada dibuat otomatis saat pertama diberi warna.
- Warna kartu **tidak** membuat versi baru jobdesk/SOP dan tidak mengganggu orang yang sedang mengedit. Setiap perubahan tetap tercatat di `audit_log`.
- Palet disimpan sekaligus dengan versi. Bila dua orang menyimpan bersamaan, yang kedua ditolak dan diminta muat ulang.
- Menghapus warna yang sedang dipakai: editor menampilkan peringatan. Setelah disimpan, kartu pemakainya kembali tanpa warna.
- **Tampilan:**
  - Kartu tanpa warna tidak berubah sama sekali di tema mana pun.
  - Neo-Brutal: kartu diisi penuh warna palet. Teks otomatis tinta atau putih, dipilih dari kontras ≥ 4,5:1; semua warna bawaan lolos.
  - Gelap: semburat tipis warna dan garis aksen kiri, sehingga suasana gelap tetap terjaga.
- Palet bawaan memakai warna tema Neo-Brutal: Kuning, Pink, Hijau, Biru, Ungu, Jingga, Biru tua, Magenta.

## Teknis
- `struktur-warna.sql`:
  - tabel `org_palet` (satu baris; isi selalu sah lewat CHECK `org__cek_palet`; tidak bisa dibaca atau ditulis langsung);
  - kolom `org_posisi.warna`;
  - RPC `org_simpan_palet(p_versi, p_warna)` dan `org_warna_posisi(p_id, p_warna)` (hanya @invisual.studio);
  - `org_struktur()` ditulis ulang: sama persis + `warna` per posisi + `palet`.
- Klien: `src/lib/struktur/warna.ts` (murni, teruji), `src/components/struktur/EditorPalet.tsx`, perubahan kecil di `Struktur.tsx`, `LaciPosisi.tsx`, `struktur.ts`. Gaya: `src/components/struktur/warna-kartu.css` (kelas `.kartu-warna` / `.chip-warna`), dimuat **hanya** oleh halaman Struktur; `globals.css` tidak diubah.
- Kode aman dipasang sebelum SQL: tanpa `palet` dari `org_struktur()`, fitur warna tidak tampil.

## Pengujian (26 Nov 2026)
- **SQL lokal:** 42 cek. Uji Struktur lama tetap 54/54.
  - pasang 2× idempoten;
  - `org_struktur()` identik untuk posisi/pemegang/staf;
  - hak lihat tetap;
  - hanya @invisual.studio menulis;
  - warna di luar palet ditolak;
  - warna tidak menaikkan versi;
  - validasi palet (format, ganda, panjang, maks. 16);
  - tabrakan versi;
  - hapus warna melepas kartu;
  - CHECK tabel;
  - audit.
- **Unit:** warna 8 (kontras palet bawaan ≥ 4,5:1, normalisasi hex, cermin validasi SQL). Semua suite lama lolos.
- **e2e:** 48 cek, mencakup:
  - tanpa SQL tidak ada yang berubah;
  - pilih/kosongkan warna;
  - Owner berbagi warna;
  - staf (posisi dibuat dulu);
  - legenda;
  - editor palet (validasi, tambah, hapus, tabrakan);
  - karyawan hanya melihat;
  - Neo-Brutal: isi penuh dan teks kontras;
  - gelap: semburat;
  - ponsel 390px tanpa gulir samping di kedua tema.
- **A/B piksel** terhadap build produksi (Struktur + Tugas), tema gelap dan Neo-Brutal:
  - Sebelum SQL: 38 tangkapan per tema (HR, PM, karyawan; 1440 & 390). Gelap 38/38 identik. Neo-Brutal: selisih hanya di 4 halaman yang tidak disentuh (dasbor, payroll, audit, satu titik di sidebar), dan terbukti bising render (produksi vs produksi juga berbeda).
  - Setelah CSS dipindah ke berkas khusus Struktur: aturan warna terbukti hanya dimuat di /admin/struktur dan /user/struktur. Halaman Struktur 12/12 identik di kedua tema.
  - SQL terpasang tanpa kartu berwarna: beda hanya tombol "Palet warna" di kepala halaman untuk editor; PM dan karyawan identik.

## Cara pasang
1. Kode: unzip `struktur-warna.zip` → `npm install && npm run build` → commit & push.
2. SQL: jalankan `struktur-warna.sql`.
