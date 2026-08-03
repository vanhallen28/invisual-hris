// src/lib/tracker/acc.ts
//
// Gerbang persetujuan brief oleh project manager.
//
// KENAPA TANPA TABEL BARU
// "Menunggu ACC" cukup jadi salah satu label di kolom Status yang sudah ada.
// Pengenalannya lewat teks — pola yang sama dengan `isDone` di MyTasks, dan
// sudah terbukti jalan. Kalau sebuah papan tidak punya label itu, tidak ada
// yang berubah sama sekali di papan tersebut: gerbangnya cuma tidak aktif.

/* ══ ALUR LENGKAP ═══════════════════════════════════════════════════════
   1. Art director menulis brief        → Menunggu ACC
   2. Project manager menyetujui        → ACC / Brief Ready
   3. Karyawan mengerjakan              → Working on it
   4. Karyawan selesai                  → Done
   5. Admin menaikkan ke marketplace    → Uploaded

   Ada DUA gerbang, bukan satu: langkah 2 (PM) dan langkah 5 (admin).
   Dan "Done" BUKAN akhir — masih menunggu admin. Berkas ini jadi sumber
   tunggal pengenalan tahap, supaya MyTasks dan antrean tidak punya versi
   aturan masing-masing yang bisa berbeda diam-diam.
   ═══════════════════════════════════════════════════════════════════════ */

/** 1 — belum disetujui PM. Karyawan tidak boleh melihatnya. */
const POLA_MENUNGGU = /menunggu\s*acc|butuh\s*acc|pending\s*acc|menunggu\s*approval|belum\s*acc/i;

/** 4 — karyawan sudah selesai, giliran admin menaikkan. */
const POLA_DONE = /\bdone\b|selesai|complete|beres|tuntas/i;

/** 5 — sudah naik, benar-benar tamat. */
const POLA_UPLOADED = /upload|terbit|publish|posted|sudah\s*tayang/i;

export const menungguAcc = (status: unknown) => POLA_MENUNGGU.test(String(status ?? ''));

/** Menunggu digarap admin (tahap 4). */
export const siapUpload = (status: unknown) => {
  const t = String(status ?? '');
  return POLA_DONE.test(t) && !POLA_UPLOADED.test(t);
};

/** Sudah naik ke marketplace (tahap 5). */
export const sudahDiupload = (status: unknown) => POLA_UPLOADED.test(String(status ?? ''));

/**
 * Tidak lagi jadi urusan KARYAWAN — mencakup Done maupun Uploaded.
 *
 * Uploaded wajib ikut. Tanpa itu, tugas yang sudah dinaikkan admin akan
 * MUNCUL LAGI di daftar tugas karyawan, karena "Uploaded" tidak cocok
 * dengan pola Done mana pun.
 */
export const sudahSelesai = (status: unknown) =>
  siapUpload(status) || sudahDiupload(status);

/**
 * Label yang berarti "sudah disetujui PM", BERJENJANG dari yang paling
 * eksplisit. Berjenjang, bukan "yang pertama ketemu di daftar" — supaya
 * hasilnya tidak berubah hanya karena urutan label di kolom diubah.
 */
const JENJANG_DISETUJUI = [
  /^\s*acc\s*$/i,                    // label persis "ACC"
  /disetujui|approved/i,
  /brief\s*ready|siap\s*dikerjakan/i,
];

/**
 * Label tujuan setelah di-ACC.
 *
 * DUA TAHAP, dan urutannya penting:
 *   1. cari label yang memang berarti "disetujui" (mis. "ACC", "Brief Ready")
 *   2. baru jatuh ke label pertama yang bukan menunggu & bukan selesai
 *
 * Tahap 1 ditambahkan karena tahap 2 saja bergantung pada URUTAN label di
 * kolom — dan urutan itu berbeda-beda tiap papan. Dengan tahap 1, papan yang
 * punya label "ACC" akan selalu mendarat di sana, apa pun urutannya.
 *
 * Tetap deterministik: PM bisa membaca tujuannya di tombol sebelum menekan.
 */
export function labelSetelahAcc(daftarLabel: any[]): string | null {
  const daftar = (daftarLabel || []).filter((l: any) => l?.text);

  for (const pola of JENJANG_DISETUJUI) {
    const cocok = daftar.find((l: any) => pola.test(l.text) && !menungguAcc(l.text));
    if (cocok) return cocok.text;
  }

  const cadangan = daftar.find(
    (l: any) => !menungguAcc(l.text) && !sudahSelesai(l.text),
  );
  return cadangan?.text ?? null;
}

/** Label tujuan setelah admin menaikkan (tahap 5). */
export function labelSetelahUpload(daftarLabel: any[]): string | null {
  const label = (daftarLabel || []).find((l: any) => l?.text && sudahDiupload(l.text));
  return label?.text ?? null;
}

export type Brief = {
  kunci: string;
  boardId: string; boardName: string;
  groupId: string; groupTitle: string; groupColor: string;
  itemId: string; subId?: string; isSub: boolean;
  nama: string; namaInduk: string | null;
  status: string; statusColId?: string;
  tanggal: string | null;
  pic: string[];
};

const nilaiTanggal = (row: any, dateCol: any, tlCol: any): string | null => {
  if (dateCol && row[dateCol.id]) return String(row[dateCol.id]).slice(0, 10);
  const tl = tlCol && row[tlCol.id];
  const v = tl?.end || tl?.start;
  return v ? String(v).slice(0, 10) : null;
};

/**
 * Kumpulkan brief dari SELURUH papan.
 *
 * Sengaja lintas papan: `board_access` bisa membatasi manajer ke papan
 * tertentu, dan justru itulah sumber double-brief — PM yang hanya melihat
 * satu papan tak akan pernah tahu orangnya sudah dipesan di papan lain.
 */
export function kumpulkanBrief(boardsDataMap: any, boardMeta: any) {
  const menunggu: Brief[] = [];   // tahap 1 — tunggu PM
  const disetujui: Brief[] = [];  // tahap 2–3 — sedang berjalan
  const perluUpload: Brief[] = [];// tahap 4 — tunggu admin

  Object.entries(boardsDataMap || {}).forEach(([boardId, bd]: any) => {
    const cols = bd.columns || [], subCols = bd.subColumns || [];
    const cari = (arr: any[], t: string) => arr.find((c: any) => c.type === t);
    const sCol = cari(cols, 'status'), tCol = cari(cols, 'team'),
          dCol = cari(cols, 'date'), lCol = cari(cols, 'timeline');
    const sSub = cari(subCols, 'status'), tSub = cari(subCols, 'team'),
          dSub = cari(subCols, 'date'), lSub = cari(subCols, 'timeline');
    const boardName = boardMeta?.[boardId]?.name || 'Board';

    (bd.groups || []).forEach((g: any) => (g.items || []).forEach((it: any) => {
      const dasar = {
        boardId, boardName, groupId: g.id, groupTitle: g.title, groupColor: g.color,
      };

      const pushKe = (b: Brief) => {
        if (menungguAcc(b.status)) menunggu.push(b);
        else if (siapUpload(b.status)) perluUpload.push(b);
        // `disetujui` dipakai untuk deteksi bentrok jadwal, jadi yang sudah
        // Done atau Uploaded sengaja TIDAK masuk — orangnya sudah bebas.
        else if (!sudahDiupload(b.status)) disetujui.push(b);
      };

      pushKe({
        ...dasar, kunci: `${boardId}-${it.id}`, itemId: it.id, isSub: false,
        nama: it.name, namaInduk: null,
        status: sCol ? String(it[sCol.id] ?? '') : '', statusColId: sCol?.id,
        tanggal: nilaiTanggal(it, dCol, lCol),
        pic: tCol && Array.isArray(it[tCol.id]) ? it[tCol.id] : [],
      });

      (it.subItems || []).forEach((sub: any) => pushKe({
        ...dasar, kunci: `${boardId}-${sub.id}`, itemId: it.id, subId: sub.id, isSub: true,
        nama: sub.name, namaInduk: it.name,
        status: sSub ? String(sub[sSub.id] ?? '') : '', statusColId: sSub?.id,
        tanggal: nilaiTanggal(sub, dSub, lSub),
        pic: tSub && Array.isArray(sub[tSub.id]) ? sub[tSub.id] : [],
      }));
    }));
  });

  return { menunggu, disetujui, perluUpload };
}

/**
 * Brief lain yang sudah disetujui untuk PIC yang sama di tanggal yang sama.
 * Hanya memberi tahu — PM tetap boleh melanjutkan (keputusan produk:
 * peringatkan, jangan blokir).
 */
export function cariBentrok(b: Brief, disetujui: Brief[]) {
  if (!b.tanggal || !b.pic.length) return [];
  return disetujui.filter(
    (d) => d.kunci !== b.kunci && d.tanggal === b.tanggal && d.pic.some((p) => b.pic.includes(p)),
  );
}
