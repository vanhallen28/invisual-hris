# Section Management P1 — catatan implementasi (24 Nov 2026)

Melengkapi `2026-11-24-section-management-prd.md` dan rencana `../plans/2026-11-24-section-management-p1-p2.md` (Task 1–8). Berkas pasang: `management-p1.zip` (kode) lalu `management-p1.sql`.

## Keputusan pengguna selama implementasi
- **Akses penuh untuk akun @invisual.studio non-owner** (akun HR dan `master@invisual.studio`, Studio Manager): otomatis berperan **Studio Manager + PM + HR** tanpa baris `mgmt_anggota`. Owner (Dea, Riza, Tryan) tetap peran `owner`. Aksi khusus leader (cek dampak divisi Sosmed/Service/Marketplace, jalur internal, Ringkasan Harian) tetap untuk leader; akun master bisa ditambahkan sebagai leader bila perlu.
- Tampilan disempurnakan sambil berjalan; fungsi diutamakan.

## Yang dibangun
| Bagian | Isi |
|---|---|
| SQL | 8 tabel `mgmt_*` (RLS + `pagar_akses_login`), fungsi hari kerja/rapat (cermin `hariKerja.ts`), fungsi peran, RPC anggota/usulan/Pedoman, `mgmt_status_baca`, `mgmt_aturan_internal`, 1 job cron per jam (`mgmt_jalankan_per_jam`), 3 kunci `pengaturan` |
| Pustaka | `src/lib/management/` hariKerja, akses, usulan, pedoman, pedomanRender, perluTindakan |
| Tampilan | `src/components/management/` + rute `/admin/management`, `/user/management`, `/user/pedoman`; menu di kedua layout; banner wajib baca |
| Lain | `marked@15` (render Markdown); 7 istilah baru di `docs/glosarium-istilah.md` |

## Penyesuaian dari rencana (hasil uji & tinjauan independen)
- Keberatan atas usulan internal: hanya PM atau anggota yang mewakili divisi lain (HR = divisi HR); ditolak setelah masa keberatan berakhir.
- Pemberian/ubah peran **Studio Manager/PM** hanya oleh Studio Manager atau owner; peran `owner` hanya untuk email owner. HR (akun pribadi) mengelola HR & leader.
- Sumber "Owner" hanya lewat "Atas nama owner" (SM) atau oleh owner sendiri.
- Status baca dihitung di server (`mgmt_status_baca`): cocok `user_id` ATAU email/`emailLogin`; hanya karyawan aktif yang punya akun; owner & akses ditutup tidak dihitung.
- RLS status baca memakai fungsi definer `mgmt_boleh_lihat_baca`, sehingga bagian DARURAT (cabut `mgmt_peran_saya`) hanya menyembunyikan UI tanpa membuat tabel galat; banner hanya tampil bila fitur terdeteksi.
- `pengaturan.mgmt_hari_rapat`/`mgmt_jam_rapat` dibaca aman (nilai tak sah → Senin 10:00), cron per langkah dibungkus agar satu galat tidak membatalkan yang lain.
- Usulan berstatus Berlaku (mis. hasil evaluasi uji coba) boleh ditautkan ke versi Pedoman.
- `dibaca_pada` tidak bisa diisi klien; nomor usulan ke-1000 aman; simpan draf & terbit dikunci bersama.
- Daftar isi Pedoman diambil dari judul hasil render → id selalu cocok.

## Pengujian (24 Nov 2026)
- SQL lokal (tiruan Supabase + akses-login terpasang): 149 cek, dijalankan 2×.
- Unit: hariKerja 3, usulan/akses 4, pedoman 3, perluTindakan 5.
- e2e (Playwright + tiruan Supabase): Task 5–8 + temuan tinjauan; regresi akses login.
- tsc & lint per berkas/aturan sama dengan baseline; A/B piksel tema gelap 17 halaman × desktop/ponsel.

## Catatan keamanan di luar fitur ini
- Hak HR seluruh HRIS (dan kini akses penuh Management) bergantung pada email `@invisual.studio` di token. Pastikan pendaftaran publik Supabase mati atau konfirmasi email wajib aktif.
- Next.js 16.4.2 dilaporkan memiliki kerentanan yang sudah diketahui; upgrade disarankan terpisah.
