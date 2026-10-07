# Glosarium istilah antarmuka — HRIS Invisual

Satu istilah untuk satu hal. Dipakai di label tombol, judul kartu, pesan toast, dan dokumentasi. Bila menambah fitur baru, cocokkan dulu dengan daftar ini.

| Pakai | Jangan pakai | Keterangan |
|---|---|---|
| **Clock In** / **Clock Out** | Absen masuk/pulang (sebagai label tombol), Check-in, Presensi masuk | Tombol utama absensi karyawan. Kapitalisasi tetap "Clock In", "Clock Out" (bukan CLOCK-IN/clock in). Di kalimat biasa boleh: "clock-in 08:41". |
| **Absen** | Kehadiran (untuk karyawan), Attendance | Nama menu/halaman di portal **karyawan**. |
| **Kehadiran** | Absensi, Timesheet (sebagai judul halaman) | Nama menu/halaman di portal **HR**. "Timesheet Heatmap" tetap sebagai nama kartu. |
| **Dasbor** | Dashboard, Panel Kontrol, Beranda | Nama menu & judul halaman pertama di kedua portal. Judul HR: "Dasbor HR". |
| **Karyawan** | Database Karyawan, Staf, Member (kecuali peran Tracker) | Menu & judul halaman daftar karyawan. |
| **Pengajuan** | Request, Permohonan | Izin, cuti, sakit, WFH/WFC, izin terlambat. Status: **Menunggu · Disetujui · Ditolak**. |
| **Izin Terlambat** | Late request, Anomali keterlambatan | Pengajuan otomatis saat clock-in terlambat. Keputusan HR: "ACC pulang 18:00" / "ACC pulang +jam". |
| **WFH / WFC** | Remote, Work From Home (panjang) di label pendek | Lokasi kerja selain Kantor; nama lengkap boleh di formulir. |
| **Lembur** / **Kompensasi** | Overtime, Comp-off | Tanda lembur oleh HR; kompensasi = "masuk siang" atau "pulang cepat" di hari kerja berikutnya. |
| **Perlu dilengkapi** | Anomali, Diagnostik, Manifest masalah | Data karyawan yang kosong (rekening, NIK, dsb.) dan keterlambatan yang belum ditinjau. |
| **Tinjau** / **Lengkapi data** | Bedah, Sembuhkan | Aksi pada panel "Perlu dilengkapi". |
| **Payroll** / **Slip gaji** | Penggajian, Payslip (dalam UI; "Payslip" hanya di dokumen slip) | Periode gaji **21 → 20**, status **Draf → Final**, lalu **Kirim** ke email. |
| **Take Home Pay (THP)** | Gaji bersih (di tabel), Net | Gaji pokok + bonus − potongan. |
| **Daily Task** | Tracker, Daily Work Tracker (di menu) | Nama menu modul tugas harian. |
| **Corporate Vault** | Vault, Arsip perusahaan | Nama menu. |
| **Log Aktivitas** | Audit, Audit log | Nama menu catatan aksi admin. |
| **Pengaturan** | Settings, Akun (kecuali label pendek nav ponsel) | Nama menu. |
| **Sedang Online** | Hadir online, Presence | Kartu daftar yang sedang membuka HRIS. |
| **Lainnya** | More, Menu | Tujuan ke-5 nav bawah ponsel HR. |

## Gaya penulisan

- Bahasa Indonesia untuk kalimat; istilah produk yang sudah lazim (Clock In, Payroll, Daily Task) dibiarkan.
- Judul kartu: huruf besar hanya di awal ("Butuh persetujuan", "Log absensi live"), bukan Title Case atau SEMUA KAPITAL.
- Tanggal untuk manusia: "Kam, 8 Okt 2026" (`teksTanggal`), bukan `2026-10-08`. ISO hanya di data & `title`.
- Angka hari: "3 hari", bukan "3 Hr".
- Pesan kosong selalu menyebut apa yang akan muncul dan (bila ada) satu aksi: "Belum ada pengajuan. — Ajukan izin / cuti".
- Hindari jargon menakutkan ("kecerdasan buatan", "pusat keamanan", "diagnostik") untuk hal rutin.
