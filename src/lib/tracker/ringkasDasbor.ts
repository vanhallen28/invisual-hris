// src/lib/tracker/ringkasDasbor.ts
// Ringkasan Daily Task untuk kartu ungu "DAILY TASK" di Dasbor HR (tema Neo-Brutal).
// Memakai aturan tahap yang SAMA dengan Antrean ACC & My Tasks (lib/tracker/acc.ts),
// sehingga angkanya tidak punya versi aturan sendiri:
//   • Menunggu ACC  = brief berstatus menunggu ACC (gerbang PM), semua papan.
//   • Tempo hari ini = brief yang sudah disetujui & belum selesai, bertanggal hari ini
//                      (kolom Date, atau ujung kolom Timeline) — sama seperti Antrean.
//   • Papan tersibuk = papan dengan brief berjalan terbanyak; progres = brief selesai
//                      (Done / Uploaded) ÷ semua brief berstatus di papan itu.
// Murni: menerima boardsDataMap yang sudah berisi kolom status/tanggal/timeline.
import { kumpulkanBrief, sudahSelesai } from "@/lib/tracker/acc";

type Kolom = { id: string; type?: string };
type Baris = { [kolom: string]: unknown; subItems?: Baris[] };
type Papan = { columns?: Kolom[]; subColumns?: Kolom[]; groups?: { items?: Baris[] }[] };
type NodePapan = { id: string; name: string; boards?: NodePapan[] };
type Ruang = { years?: { months?: { boards?: NodePapan[] }[] }[] };

export type RingkasDailyTask = {
  menunggu: number;
  tempoHariIni: number;
  papan: { id: string; nama: string; selesai: number; total: number; persen: number } | null;
};

export function ringkasDailyTask(boardsDataMap: Record<string, Papan> | null | undefined, boardMeta: Record<string, { name: string }>, hariIni: string): RingkasDailyTask {
  const { menunggu, disetujui } = kumpulkanBrief(boardsDataMap || {}, boardMeta);
  const tempoHariIni = disetujui.filter((b) => b.tanggal === hariIni).length;

  // Brief berjalan per papan → papan tersibuk.
  const berjalan: Record<string, number> = {};
  for (const b of disetujui) berjalan[b.boardId] = (berjalan[b.boardId] || 0) + 1;
  const idTersibuk = Object.entries(berjalan).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];

  let papan: RingkasDailyTask["papan"] = null;
  const bd = idTersibuk ? (boardsDataMap || {})[idTersibuk] : null;
  if (bd && idTersibuk) {
    const sCol = (bd.columns || []).find((c) => c.type === "status");
    const sSub = (bd.subColumns || []).find((c) => c.type === "status");
    let total = 0, selesai = 0;
    const hitung = (row: Baris, col: Kolom | undefined) => {
      if (!col) return;
      const st = String(row?.[col.id] ?? "").trim();
      if (!st) return;
      total++;
      if (sudahSelesai(st)) selesai++;
    };
    for (const g of bd.groups || []) for (const it of g.items || []) {
      hitung(it, sCol);
      for (const s of it.subItems || []) hitung(s, sSub);
    }
    papan = { id: idTersibuk, nama: boardMeta[idTersibuk]?.name || "Board", selesai, total, persen: total ? Math.round((selesai / total) * 100) : 0 };
  }
  return { menunggu: menunggu.length, tempoHariIni, papan };
}

/** Nama papan bertingkat ("MARKETPLACE › Okt") dari pohon workspace → tahun → bulan → papan. */
export function metaPapan(workspaces: Ruang[] | null | undefined): Record<string, { name: string }> {
  const meta: Record<string, { name: string }> = {};
  const catat = (bs: NodePapan[] | undefined, induk: string) => (bs || []).forEach((b) => {
    const nama = induk ? `${induk} › ${b.name}` : b.name;
    meta[b.id] = { name: nama };
    catat(b.boards, nama);
  });
  (workspaces || []).forEach((ws) => (ws.years || []).forEach((y) => (y.months || []).forEach((mo) => catat(mo.boards, ""))));
  return meta;
}
