# Hari Libur (tanggal merah) + perbaikan lembur — rancangan (8 Okt 2026)

Disetujui pengguna 8 Okt 2026 ("ya setuju"). Pilihan: tabel dikelola HR; cuti bersama diatur HR per tanggal; lembur di hari libur memakai aturan yang sama dengan hari kerja.

## Data — `hari-libur.sql`
- Tabel `hari_libur(tanggal date PK, nama, jenis nasional|cuti_bersama|kantor, libur bool, diubah_oleh, diubah_pada)`; constraint: nasional selalu libur.
- RLS: baca = semua pengguna login; ubah = `pp_staf` (HR @invisual.studio / manajer).
- Isi awal SKB 3 Menteri 2026 (SKB 19 Sep 2025: 17 libur nasional + 8 cuti bersama) dan 2027 (SKB 15 Sep 2026: 18 + 8). `on conflict do nothing` → aman diulang, pilihan HR tidak tertimpa.
- Tabel belum ada → aplikasi berperilaku persis seperti sebelumnya (hanya Sabtu–Minggu libur).

## Aturan
- Hari non-kerja = Sabtu, Minggu, atau baris `hari_libur` dengan `libur = true`.
- Heatmap Kehadiran: urutan status = belum bergabung → absen (Hadir/Telat) → **tanggal merah** ("Libur Nasional", tidak dihitung alpa) → izin/cuti → akhir pekan → Alpa. Cuti bersama yang disetel Masuk = hari kerja biasa. CSV: kode **N**.
- Lembur: boleh ditandai di akhir pekan & tanggal merah; sah bila clock-out ≥ 60 menit lewat jam wajib pulang (sama dengan hari kerja). Hari kompensasi = hari kerja berikutnya yang melewati tanggal merah. `hariLemburUntuk` adalah kebalikan persisnya.
- Batal lembur (atau tanda tidak sah lagi): bila ada tanda sah lain ke hari kompensasi yang sama → dipakai; bila tidak dan status kembali Terlambat → Izin Terlambat yang disetujui OTOMATIS (alasan berakhiran "(kompensasi lembur)") kembali Menunggu, akhiran dihapus. Izin yang disetujui HR manual tidak disentuh.
- Satu tanda = satu pemakaian: tanda yang sudah terpakai di tanggal lain (daftar libur diubah setelahnya) tidak ditawarkan lagi, dan pembatalan memulihkan absen yang benar-benar memakainya.

## Tampilan
- Kehadiran HR: kolom tanggal merah, legenda, detail sel (nama libur), Tandai lembur di semua hari ≤ hari ini yang ada absennya.
- Kalender Cuti & Izin: sel merah + nama hari besar, daftar "Hari libur <bulan>", jendela tanggal menyebut liburnya.
- Pengaturan HR › Kalender Kerja › "Hari Libur & Cuti Bersama": per tahun, sakelar Libur/Masuk (cuti bersama & kantor), tambah/hapus, audit log.
- Pita `InfoLibur`: Dasbor & Absen karyawan, Dasbor HR — "Hari ini libur" + "Libur berikutnya" (≤ 90 hari).
- Dialog Tandai lembur: pratinjau hari kompensasi + catatan aturan bila tanggalnya hari libur.

## Di luar cakupan
Penilaian terlambat saat clock-in di hari libur (tetap seperti akhir pekan sekarang), payroll, galeri foto absen, hitungan "Belum absen" di dasbor HR.
