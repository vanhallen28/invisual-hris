# Lazy-load Daily Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biaya membuka Daily Task (dan menambah board) tidak lagi tumbuh bersama total data: struktur dimuat sekali, isi sel dimuat per kebutuhan (board yang dibuka, tugas saya, kolom lintas-board tertentu), plus ubah massal ber-ceklis ikut ke semua sub-item.

**Architecture:** `load.ts` dipecah: `loadStrukturState` (tanpa `item_values`/`item_assignees`) + pemuat sel tertarget (`loadSelItem`, `loadKolom`, `loadIdItemSaya`) + fungsi murni penggabung (`terapkanSel`, `terapkanKolom`, `terapkanTim`, `pertahankanSel`). Modul baru `pemuat.ts` menyimpan status "apa yang sudah termuat" dan mengatur muat (dedupe, proteksi edit, batch tim) — murni TS, bisa dites tanpa React. `DashboardContext` hanya merangkai: init struktur, refresh struktur (pengganti muat ulang penuh), realtime terarah, dan mengekspos fungsi pemicu muat yang dipanggil komponen pembaca (model *pull*).

**Tech Stack:** Next.js 16 / React / TypeScript / supabase-js v2 (PostgREST). Tes: `node --experimental-strip-types` (Node 22) dengan klien supabase palsu di scratchpad — tidak dikirim ke repo.

## Global Constraints

- Perubahan tidak boleh mengganggu/merubah fitur lain ("kode yang anda kirim dan perubahan yang terjadi tidak menganggu fitur dan fungsi yang lainya").
- Bentuk `boardsDataMap` tetap: `{[boardId]: {groups, columns, subColumns, views}}`; item: `{id, name, isSubItemsOpen, description, subItems, [colId]: nilai}`; kolom tim = array member id.
- `loadFullState` tetap ada & keluarannya identik (dipakai halaman Pendapatan).
- Nama ekspor konteks lama tetap (`refreshData`, `boardsDataMap`, dst.). Tambahan hanya aditif.
- Tanpa perubahan skema/SQL wajib. Index SQL hanya opsional (percepatan).
- Pengiriman: ZIP berisi path relatif proyek (`unzip -o` dari root), nama unik; `npm run build` gagal di sandbox hanya karena Google Fonts (normal).

## Peta Berkas

| Berkas | Status | Tanggung jawab |
|---|---|---|
| `src/lib/tracker/load.ts` | ubah | fetch (struktur, sel tertarget) + fungsi murni penggabung |
| `src/lib/tracker/pemuat.ts` | baru | status termuat, dedupe, proteksi edit, batch tim, snapshot cache |
| `src/components/tracker/DashboardContext.tsx` | ubah | init/refresh struktur, realtime, ekspor pemicu muat, cascade + simpan batch, hapus label sisi server |
| `src/components/tracker/ManagerBoard.tsx` | ubah kecil | muat board aktif + loader "Memuat papan" |
| `src/components/tracker/MyTasks.tsx` | ubah kecil | muat tugas saya + loader |
| `src/components/tracker/AntreanAcc.tsx` | ubah kecil | muat kolom status/tim/tanggal/timeline lintas board + loader |
| `src/components/tracker/ViewTabs.tsx` | ubah kecil | muat kolom status lintas (badge), 0 sampai siap |
| `src/components/tracker/Overview.tsx` | ubah kecil | pastikan sub-board termuat (MARKETPLACE) |
| `src/components/chat/ChatRoom.tsx` | ubah kecil | kartu tugas: pastikan item termuat |
| `src/components/tracker/TableCell.tsx` | ubah kecil | mode ceklis berlaku mulai 1 baris + banner "+ sub-item" |
| `index-lazy-load.sql` (keluaran terpisah) | baru, opsional | index `item_values(column_id)`, `item_assignees(member_id)`, `item_assignees(column_id)` |

---

### Task 1: load.ts — fetch terpisah + paginasi tanpa `count`

**Files:** Modify `src/lib/tracker/load.ts`; Test `<scratchpad>/tes/load.test.ts`

**Interfaces (Produces):**
```ts
export async function ambilSemua(supabase, tabel: string, kolom?: string, opsi?: { saring?: (q:any)=>any; urut?: string[] }): Promise<any[]>
export async function loadFullState(supabase): Promise<FullState>        // keluaran sama seperti sebelumnya
export async function loadStrukturState(supabase): Promise<FullState>   // tanpa nilai sel
export async function loadSelItem(supabase, ids: string[]): Promise<{ values: any[]; assignees: any[] }>
export async function loadKolom(supabase, idsNilai: string[], idsTim: string[]): Promise<{ values: any[]; assignees: any[] }>
export async function loadIdItemSaya(supabase, uid: string): Promise<string[]>
export async function loadTimItem(supabase, ids: string[]): Promise<any[]>
export async function ambilNilaiKolom(supabase, columnId: string): Promise<{ item_id: string; value: any }[]>
export function idItemBoard(bd: any): string[]
export function semuaIdItem(peta: Record<string, any>): Set<string>
export function kolomPertamaPerTipe(peta, tipe: string[]): { nilai: string[]; tim: string[] }
export function idItemBertim(peta, uid: string): string[]
export type Lindung = Map<string, Set<string>>   // itemId -> colIds
export function terapkanSel(peta, values, assignees, diminta: Set<string>, lindung?: Lindung): Record<string, any>
export function terapkanKolom(peta, values, assignees, kolomIds: Set<string>, lewati: Set<string>, lindung?: Lindung): Record<string, any>
export function terapkanTim(peta, antrian: Map<string, Set<string>>, rows: any[], lindung?: Lindung): Record<string, any>
export function pertahankanSel(baru: Record<string, any>, lama: Record<string, any>): Record<string, any>
```

- [ ] **Step 1: Tulis tes gagal** — klien palsu mendukung `from().select().in().eq().order().range()`; kasus: (a) 2500 baris → 3 halaman, tanpa `count`; (b) tepat 1000 → berhenti setelah halaman kosong; (c) 0 baris; (d) `urut` dipanggil; (e) `loadSelItem` memotong 250 id jadi 3 potongan `.in`; (f) `terapkanSel` mengganti sel item diminta, mempertahankan sel dilindungi, tidak menyentuh item lain (referensi sama), tim jadi array tanpa duplikat, sub-item; (g) `terapkanKolom` hanya kolom diminta, item `lewati` tak disentuh, nilai hilang → kunci dihapus; (h) `terapkanTim` set array / `[]`; (i) `pertahankanSel` menyalin sel item lama (termasuk item pindah board), item baru kosong, views lama dipertahankan; (j) `kolomPertamaPerTipe` & `idItemBertim`.
- [ ] **Step 2:** `node --experimental-strip-types tes/load.test.ts` → FAIL (ekspor belum ada).
- [ ] **Step 3: Implementasi.** `ambilSemua`: halaman 0; bila penuh (1000) lanjut gelombang paralel 6 halaman, berhenti saat ada halaman < 1000; `.order(k)` untuk tiap `urut`; tanpa `count`. `loadFullState`/`loadStrukturState` berbagi `ambilMentah(supabase, denganSel)` + `bangunState(mentah)`; `auth.getUser()` dijalankan paralel dengan tabel. `items` struktur memakai kolom `id, group_id, parent_item_id, name, position, is_subitems_open, description`. Urutan: tabel ber-`id` → `['id']`; `item_values` → `['item_id','column_id']`; `item_assignees` → `['item_id','column_id','member_id']`; `account_targets` tanpa urut. `loadSelItem`: potongan 100 id, 4 potongan paralel × 2 tabel. `loadKolom`: potongan 50 kolom `.in('column_id', …)`.
- [ ] **Step 4:** Jalankan tes → PASS.
- [ ] **Step 5:** "Commit" = simpan berkas (repo tanpa git; dirakit ke ZIP di Task 6).

### Task 2: pemuat.ts — pengendali muat sel

**Files:** Create `src/lib/tracker/pemuat.ts`; Test `<scratchpad>/tes/pemuat.test.ts`

**Interfaces:**
- Consumes: semua fungsi Task 1.
- Produces:
```ts
export type DepPemuat = { supabase: any; ambilPeta: () => Record<string, any>; ubahPeta: (fn: (p: any) => any) => void; saatBerubah: () => void; lapor?: (pesan: string) => void; sekarang?: () => number; jedaTim?: number; jedaItem?: number };
export type TandaPemuat = { tampil: string[]; saya: boolean; tipe: string[] };
export function buatPemuat(dep: DepPemuat): {
  muatSelBoard(boardId: string, opsi?: { paksa?: boolean }): Promise<void>;
  muatSelSaya(uid: string, opsi?: { paksa?: boolean }): Promise<void>;
  muatKolomLintas(tipe: string[], peta?: Record<string, any>): Promise<void>;
  pastikanItem(ids: string[]): Promise<void>;
  pastikanBoards(ids: string[]): Promise<void>;
  sesudahStruktur(petaBaru: Record<string, any>, lamaIds: Set<string>): Promise<void>;
  tandaiEdit(itemId: string, colId: string, lokal?: boolean): void;
  tambalTim(itemId: string, colId: string): void;
  tandaiPapanSiap(boardId: string): void;
  papanSiap(boardId: string): boolean; sayaSiap(): boolean; sayaDiminta(): boolean; lintasSiap(tipe: string[]): boolean;
  galat(kunci: string): string | null;
  snapshot(): TandaPemuat; pulihkan(t: TandaPemuat): void; reset(): void;
}
```
- [ ] **Step 1: Tes gagal** — supabase palsu + peta di memori (ubahPeta menerapkan updater langsung). Kasus: muatSelBoard memuat hanya id board itu, menandai siap, panggilan kedua tanpa jaringan, dua panggilan bersamaan = 1 fetch; edit lokal setelah fetch mulai tidak tertimpa; muatSelSaya memuat item yang di-assign + item yang tampak berisi saya; muatKolomLintas tidak menimpa item yang sudah penuh; sesudahStruktur memuat item baru & item tanpa sel di board termuat; tambalTim di-batch jadi 1 query; galat tercatat & board tidak ditandai siap; reset membatalkan hasil fetch lama; snapshot/pulihkan.
- [ ] **Step 2:** Jalankan → FAIL.
- [ ] **Step 3:** Implementasi (Set `items/boards/tampil/kolom/tipeLintas/tipeTampil`, Map `proses` untuk dedupe, Map `edit` waktu edit per `item|kolom`, jendela lindung 60 dtk, edit lokal < 3 dtk dilewati `tambalTim`, `gen` untuk membatalkan hasil basi).
- [ ] **Step 4:** Tes → PASS. **Step 5:** simpan.

### Task 3: DashboardContext — orkestrasi

**Files:** Modify `src/components/tracker/DashboardContext.tsx`

**Interfaces (Produces, ekspor konteks tambahan):** `muatSelBoard(id, opsi?)`, `muatSelSaya(opsi?)`, `muatKolomLintas(tipe)`, `pastikanItem(ids)`, `pastikanBoards(ids)`, `papanSiap(id)`, `sayaSiap()`, `lintasSiap(tipe)`, `galatMuat(kunci)`, `kolomSubSerupa(col)`.

- [ ] Init: cache (bila uid cocok) → pulihkan state + `pemuat.pulihkan` + `refreshData()` latar; jika tidak → `loadStrukturState` → set state → `isLoaded`. Pilih board tersimpan sama seperti sebelumnya.
- [ ] `refreshData` = refresh struktur (digabung bila sedang berjalan + 1 putaran susulan): meta → `setBoardsDataMap(prev => pertahankanSel(ensureViews(baru), prev))` → `pemuat.sesudahStruktur(baru, lamaIds)`.
- [ ] Cache disimpan lewat efek (state + `pemuat.snapshot()`).
- [ ] Realtime: `item_values` → `tandaiEdit(...,false)` + `tambalSel`; struktur → `refreshData` (berjeda, guard tulis-sendiri tetap); `item_assignees` untuk SEMUA peran → `tambalTim` + (milik saya) `muatSelSaya` berjeda; tanpa `item_id` → muat paksa board aktif + tugas saya. Kanal `member-assignees-refresh` dihapus (tergabung).
- [ ] Efek: detail terbuka → `muatSelBoard(activeBoardId)` (anggota melihat panel lengkap).
- [ ] `tandaiEdit` di `handleUpdateItem/SubItem`, `handleBulkSetField`, `moveGroupToBoard`.
- [ ] `addBoard` → `pemuat.tandaiPapanSiap(id)` + `tandaiTulisSendiri()` setelah tulis cloud.
- [ ] `handleDeleteLabel`: pembersihan cloud memakai `ambilNilaiKolom` (fallback daftar lokal).
- [ ] `handleBulkSetField`: cascade ke sub-kolom berlabel & bertipe sama di semua sub-item item terpilih; label status/tags yang belum ada di sub-kolom ditambahkan (warna sama); simpan cloud batch (`simpanMassal`: upsert/hapus `.in`, tim: hapus+insert) dengan fallback per-item.
- [ ] `doLogout` → `pemuat.reset()`.
- [ ] Verifikasi: kurung seimbang, `tsc` berkas tanpa error baru.

### Task 4: Titik sentuh UI (aditif)

- [ ] ManagerBoard: `useEffect(() => { if (activeBoardId) void muatSelBoard(activeBoardId); }, [activeBoardId])`; view papan (table/kanban/gantt/chart/calendar/workload) diganti loader `LoadingLogo "Memuat papan"` selama `!papanSiap(activeBoardId)`; bila `galatMuat('b:'+id)` → pesan + tombol "Coba lagi".
- [ ] MyTasks: efek `muatSelSaya()`; sebelum `return` utama: loader bila `!sayaSiap()`.
- [ ] AntreanAcc: efek `muatKolomLintas(['status','team','date','timeline'])`; loader setelah blok "Khusus project manager".
- [ ] ViewTabs: efek (jeda 1500 ms) `muatKolomLintas(['status'])`; `jumlahAcc` 0 sampai `lintasSiap(['status'])`.
- [ ] Overview: efek `pastikanBoards(subBoardIds)` bila MARKETPLACE; label kecil "memuat sub-board…".
- [ ] ChatRoom `TaskCard`: efek `pastikanItem([taskId])` sebelum early return.
- [ ] TableCell: `applyBulk` berlaku bila baris tercentang (≥ 1); banner menampilkan "+ sub-item" bila `kolomSubSerupa(col)`.

### Task 5: Verifikasi

- [ ] Tes node Task 1–2 PASS.
- [ ] `npx tsc --noEmit` disaring per berkas yang disentuh: tidak ada error BARU (baseline dicatat sebelum perubahan).
- [ ] `npm run build`: hanya gagal Google Fonts.
- [ ] Review independen (subagen) atas diff DashboardContext + pemuat.
- [ ] Checklist manual untuk pengguna (bagian 11 spec + cascade + tambah board).

### Task 6: Rakit & kirim

- [ ] ZIP `lazy-load-daily-ringan.zip` (path relatif): load.ts, pemuat.ts, DashboardContext.tsx, ManagerBoard.tsx, MyTasks.tsx, AntreanAcc.tsx, ViewTabs.tsx, Overview.tsx, ChatRoom.tsx, TableCell.tsx, spec + plan.
- [ ] `index-lazy-load.sql` (opsional).
