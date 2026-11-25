# Struktur Perusahaan — catatan implementasi (25 Nov 2026)

Tahap A dari "Struktur & Tugas Management" (pratinjau disetujui 25 Nov 2026). Tahap B (tab Tugas + alur harian leader) menyusul.

## Yang dibangun
| Bagian | Isi |
|---|---|
| SQL `struktur.sql` | Tabel `org_posisi` (jenis owner/studio_manager/pm/hr/leader/staf, judul, divisi, `peran_mgmt`, pemegang manual, jobdesk & SOP markdown, tugas rutin jsonb, `bagian_pedoman`, versi) dan `org_posisi_riwayat`. RPC `org_struktur()` (satu panggilan: posisi + pemegang + staf), `org_simpan_posisi`, `org_posisi_staf`, `org_boleh_lihat()`. Sakelar `struktur_terbuka`. Isi awal 8 posisi dari Pedoman v1.0. |
| Halaman | Menu **Struktur** (portal HR grup "Perusahaan" & portal karyawan). Bagan Owner → Studio Manager → PM & HR → 3 Leader → staf per divisi; laci Jobdesk · SOP · Tugas rutin · KPI · Riwayat. |
| Pengaturan | Kartu "Struktur perusahaan untuk semua karyawan" (hanya tampil untuk akun @invisual.studio). |
| Pustaka | `src/lib/struktur/struktur.ts` (murni, teruji). Komponen di `src/components/struktur/`. |

## Aturan
- **Lihat:** akun @invisual.studio selalu. Karyawan lain hanya bila sakelar nyala. Sakelar mati → `org_struktur()` mengembalikan `boleh_lihat:false` tanpa data, dan menu tidak muncul.
- **Edit:** hanya @invisual.studio (judul, pemegang manual, jobdesk, SOP, tugas rutin). Tidak ada tulis langsung ke tabel; semua lewat RPC.
  - Setiap simpan menaikkan versi dan menambah riwayat (siapa, kapan, catatan), serta tercatat di `audit_log` ("Management: Ubah struktur").
  - Dua orang mengedit bersamaan → yang kedua ditolak ("baru saja diubah orang lain"), lalu diminta muat ulang.
  - "Kembalikan" = menyimpan isi versi lama sebagai versi baru.
- **Pemegang:** posisi management diisi otomatis dari Management → Anggota. Nama diambil dari nama panggilan karyawan bila emailnya cocok. Owner ditulis manual (Dea; Riza & Tryan).
- **Judul jabatan leader:** Lead Marketing & Sosmed (Eko), Art Director (Jo, divisi Service), Lead Marketplace (Syahrul). Bisa diedit.
- **Staf:** karyawan aktif selain pemegang posisi management dan owner. Data yang dikirim hanya nama, jabatan, dan divisi.
  - Jobdesk ditulis per **divisi + jabatan**; posisinya dibuat saat pertama kali disimpan.
  - Penempatan divisi memakai `mgmt_divisi_staf` & RPC P1 `mgmt_atur_divisi_staf`. Tombol "Atur penempatan staf" hanya untuk @invisual.studio.
- **KPI:** tidak disimpan di Struktur. Tab KPI membaca tabel "| Kode |" di bawah judul `### {bagian_pedoman}` dari Pedoman yang berlaku. KPI berubah hanya lewat Usulan.
- **Tugas rutin:** judul, ritme (harian/mingguan/bulanan), waktu, dan sumber centang otomatis. Delapan sumber dicerminkan di `org__cek_rutin` dan `SUMBER_OTOMATIS`. Dipakai tab Tugas (tahap B).

## Pengujian (25 Nov 2026)
- **SQL lokal:** 54 cek (pasang 2× idempoten; hak lihat mati/nyala; hanya @invisual.studio menulis; tabrakan versi; validasi rutin/judul/panjang; posisi staf; akses login ditutup; jalan ulang tidak menimpa edit). `struktur-penempatan-awal.sql`: tidak menimpa penempatan yang ada, melewati karyawan nonaktif.
- **Unit:** struktur 9 (termasuk KPI keenam SOP dari Pedoman v1.0). Semua suite lama lolos. Uji rute pengingat kini mengunci jam, karena sebelumnya bergantung pada tanggal hari ini.
- **e2e:** 39 cek (belum dipasang, HR edit/riwayat/kembalikan/rutin/tabrakan/staf/penempatan, karyawan baca saja, ditutup, ponsel tanpa gulir samping, sakelar Pengaturan).
- **A/B piksel** tema gelap terhadap build setelah paket gerbang: 66 tangkapan (lebar 1440 & 390; HR, PM, karyawan; SQL belum dipasang dan Management tertutup). Semua identik kecuali Pengaturan (kartu baru, memang berubah).

## Cara pasang
1. Kode: unzip `struktur.zip` → `npm install && npm run build` → commit & push. Tanpa SQL, menu Struktur tidak muncul; di Pengaturan ada kartu berlabel "Belum berlaku".
2. SQL: jalankan `struktur.sql`.
3. Opsional: `struktur-penempatan-awal.sql` bila tebakan penempatan staf sudah benar. Bila belum, atur di Struktur → "Atur penempatan staf".
4. Bila sudah siap untuk semua karyawan: nyalakan sakelar di Pengaturan.

## Darurat
`revoke execute on function public.org_struktur(), public.org_boleh_lihat() from authenticated;` → menu & halaman Struktur hilang untuk semua; data utuh. Pulihkan dengan `grant execute … to authenticated;`.
