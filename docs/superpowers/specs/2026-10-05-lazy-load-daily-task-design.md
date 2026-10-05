# Spec — Lazy-load Daily Task + Cascade Sub-item

**Tanggal:** 2026-10-05
**Modul:** InVisual HRIS — Tracker (Daily Task)
**Status:** disetujui & diimplementasikan (lihat Catatan Implementasi di bawah)

---

## 1. Masalah

`loadFullState` (`src/lib/tracker/load.ts`) menarik **seluruh** `item_values` (nilai tiap sel) untuk **semua board** setiap kali Daily Task dibuka, lalu membangun `boardsDataMap` penuh di memori. Biaya ini **tumbuh lurus dengan total data** — makin banyak board/item/kolom, makin lama muatnya. Paginasi paralel yang ada hanya menunda langit-langit, tak menghapusnya. Tambahan: `count:'exact'` pada tabel besar menjalankan `COUNT(*)` penuh yang ikut melambat seiring data bertambah.

## 2. Tujuan & Non-tujuan

**Tujuan**
- Biaya **buka Daily Task dibatasi per board** (bukan total data) → tahan pertumbuhan data.
- Fitur lintas-board tetap **akurat** (dimuat saat halaman dibuka).
- Perubahan **aditif & terpusat**; komponen fitur nyaris tak disentuh.
- Tambahan: ubah massal (pilih-semua) **cascade ke semua sub-item** (kolom bernama sama).

**Non-tujuan**
- Tidak memindah agregasi Overview/Pendapatan ke SQL (itu opsi terpisah di masa depan).
- Tidak mengubah UI/komponen fitur selain gerbang "pastikan sel termuat".
- Tidak menyentuh modul di luar Tracker.

## 3. Arsitektur

Yang berat = `item_values` (≈ jumlah_item × jumlah_kolom). Maka **tunda memuat sel**, bukan struktur. `boardsDataMap` tetap jadi sumber tunggal yang dibaca komponen; hanya *kapan* selnya terisi yang berubah.

Tiga fungsi muat (di `load.ts` + diorkestrasi `DashboardContext`):

1. **`muatStruktur()`** — ringan. Tarik: `tree_nodes`, `groups`, `columns`, `column_options`, `members`, `account_targets`, dan `items` (baris saja: id, group_id, parent_item_id, name, position, is_subitems_open, description). Bangun `boardsDataMap` lengkap **tanpa sel** (sel kosong). Papan tampil sebagai kerangka. **Tidak** menarik `item_values`/`item_assignees`.

2. **`muatSelBoard(boardId)`** — saat board dibuka. Ambil id semua item board itu dari struktur, lalu tarik `item_values` & `item_assignees` dengan filter `.in('item_id', ids)` (dibatch ≤200 id/permintaan). Gabungkan ke `boardsDataMap[boardId]`. Biaya dibatasi 1 board.

3. **`muatSemuaSel()`** — tarik semua sel (beban lama), **hanya** saat halaman lintas-board dibuka. Idempoten; menandai `semuaSelTermuat = true` agar tak diulang.

### Status muat
`DashboardContext` memegang penanda:
- `selBoardTermuat: Set<boardId>` — board yang selnya sudah ditarik.
- `semuaSelTermuat: boolean` — seluruh sel sudah ditarik.

## 4. Alur data

- **Muat awal:** `muatStruktur()` → papan tampil cepat. Board aktif (tersimpan) langsung `muatSelBoard(aktif)`.
- **Buka board lain:** `setActiveBoardId(id)` → jika `!selBoardTermuat.has(id)` → `muatSelBoard(id)` (spinner kecil di area tabel).
- **Buka halaman lintas-board** (My Tasks, Antrean ACC, Overview, Pendapatan, Notifikasi): jika `!semuaSelTermuat` → `muatSemuaSel()` (indikator loading), baru render.

## 5. Gerbang halaman lintas-board

Semua pembaca `boardsDataMap` lintas-board **wajib** di belakang gerbang `muatSemuaSel()`. Inventaris (hasil telusur):
- `MyTasks.tsx` — iterasi semua board (tugas milik user).
- `AntreanAcc.tsx` — `kumpulkanBrief(boardsDataMap, …)` lintas board.
- `NotificationCenter.tsx` — iterasi semua board.
- `Overview.tsx` — board aktif + sub-board (butuh sel board-board itu).
- `ViewTabs.tsx` — iterasi `boardsDataMap` (perlu dicek: jika hanya metadata view, cukup struktur; jika butuh sel, ikut gerbang).

Pola gerbang: saat komponen mount / tab dibuka → `await muatSemuaSel()` → tampilkan spinner sampai selesai → render seperti biasa (logika komponen tak diubah).

## 6. Perbaikan `count`

- `muatSelBoard`: pakai `.in('item_id', ids)` + paginasi berdasar jumlah id yang sudah diketahui → **tanpa** `count`.
- `muatSemuaSel`: paginasi paralel **tanpa `count:'exact'`** — pakai gelombang paralel yang berhenti saat satu halaman < 1000 (atau `count:'estimated'` yang murah). Menghapus pajak `COUNT(*)` penuh.

## 7. Realtime & cache

- **Realtime sel** (`tambalSel` pada `item_values`): tetap menambal; jika board target belum termuat selnya, patch dilewati (akan benar saat board dibuka). Realtime struktur (items/groups/columns/tree) → muat ulang **struktur** (ringan), bukan semua sel.
- **Cache:** simpan **struktur** (buka berikutnya instan). Sel board ditarik saat buka (sudah ringan). `semuaSelTermuat` tidak dipersist (cold per sesi) agar aman.

## 8. Tambahan — cascade ke sub-item

`handleBulkSetField(ids, col, value)` diperluas:
- Tetap set `col.id` pada item terpilih.
- **Cari sub-kolom bernama sama** (`subColumns` dengan label == `col.label`); jika ada, set nilainya pada **semua sub-item** milik item-item terpilih — lokal (state) + cloud (batch `upsert`/`item_assignees`, pola sama dengan fix duplicate agar cepat & tak memicu reload).
- Jika tak ada sub-kolom sejenis → cascade dilewati (hanya item).
- Tandai tulis-sendiri selama proses (anti reload/flicker).

## 9. Fase (urutan aman, tiap fase diuji sebelum lanjut)

- **Fase 1** — `muatStruktur` + `muatSelBoard` + muat board aktif saat start + spinner per-board + perbaikan `count`. (Board view jadi ringan.)
- **Fase 2** — `muatSemuaSel` + gerbang di My Tasks / ACC / Overview / Pendapatan / Notifikasi / (ViewTabs bila perlu).
- **Fase 3** — cascade sub-item + poles cache/realtime.

## 10. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Pembaca lintas-board terlewat dari gerbang → data tampak kosong | Inventaris lengkap (bagian 5), pasang gerbang di tiap titik, uji satu-satu |
| `muatSelBoard` dengan `.in()` id sangat banyak | Batch ≤200 id/permintaan, paralel |
| Realtime menambal board belum termuat | Lewati dengan aman; terisi saat board dibuka |
| Pindah grup antar board ke board belum termuat | Pastikan `muatSelBoard(tujuan)` sebelum pindah |
| Regres fitur lain | Perubahan terpusat di load + konteks; komponen hanya ditambah gerbang |

## 11. Checklist uji

- Buka Daily Task → kerangka tampil cepat; board aktif terisi selnya.
- Pindah board → sel board itu muncul (spinner singkat); board lama tetap benar.
- My Tasks / ACC / Overview / Pendapatan / Notifikasi → muat sel-semua sekali (spinner), data **lengkap & benar**.
- Edit sel → realtime tetap jalan antar perangkat.
- Pindah grup antar board → board tujuan termuat, data terbawa benar.
- Pilih-semua → ubah status → item **dan semua sub-item** ikut berubah; tanpa flicker.
- Build lolos; tak ada regresi fitur lain.

## 12. Berkas yang disentuh

- `src/lib/tracker/load.ts` — pisah `muatStruktur` / `muatSelBoard` / `muatSemuaSel` + fix `count`.
- `src/components/tracker/DashboardContext.tsx` — orkestrasi muat, penanda status, `handleBulkSetField` cascade.
- `src/components/tracker/MyTasks.tsx`, `AntreanAcc.tsx`, `NotificationCenter.tsx`, `Overview.tsx`, (`ViewTabs.tsx` bila perlu) — gerbang `muatSemuaSel()`.
- (Kemungkinan) `ManagerBoard.tsx`/area board view — spinner per-board.

## 13. Catatan implementasi (penyesuaian dari rancangan)

- **Model "tarik":** sel dimuat oleh komponen yang membutuhkannya (`pemuat.ts`), bukan oleh konteks saat aplikasi dibuka — halaman Chat tidak ikut memuat isi papan.
- **Lintas papan tanpa `muatSemuaSel`:** Antrean ACC memuat hanya kolom status/PIC/tanggal/timeline semua papan; badge Antrean memuat hanya kolom status (latar, tertunda 1,5 dtk); My Tasks memuat hanya item yang di-assign ke saya; Overview MARKETPLACE memuat sub-board-nya; kartu tugas chat memuat itemnya saja. NotificationCenter cukup kerangka.
- **Refresh = kerangka saja** (`refreshData`): sel di memori dipertahankan per id item (termasuk item pindah), view kustom tidak lagi ter-reset; hanya item baru / item tanpa sel di papan termuat yang selnya dimuat.
- **Realtime penugasan** ditambal tepat sasaran (`tambalTim`, di-batch) untuk semua peran; kanal `member-assignees-refresh` (muat ulang penuh) dihapus.
- **Proteksi edit:** sel yang diubah lokal/realtime ≤ 60 dtk sebelum fetch dimulai tidak ditimpa hasil fetch yang lebih lama.
- **Penyembuhan diri:** kanal realtime tersambung ulang atau tab kembali setelah > 1 menit → kerangka + sel yang sedang dipakai dimuat ulang.
- **Cascade** berlaku pada mode massal yang sudah ada (≥ 2 baris dicentang); sub-kolom dicocokkan dengan label (abaikan besar-kecil) DAN tipe yang sama; label status/tags yang belum ada di sub-kolom ditambahkan dengan warna sama. Penyimpanan nilai: 1 kueri per 100 item; penugasan tetap per item (5 paralel) agar kegagalan tak mengosongkan PIC massal.
- **Pembersihan label terhapus** memakai data server (`ambilNilaiKolom`), cadangan daftar memori.
- **Paginasi** tanpa `count:'exact'`, bergelombang 1→2→4→6 halaman, ber-`ORDER BY` kunci unik.
- **Index opsional:** `index-lazy-load.sql`.
