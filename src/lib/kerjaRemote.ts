// src/lib/kerjaRemote.ts
//
// Aturan bersama absen WFH / WFC (dipakai halaman Absen & Dasbor karyawan):
// WFH/WFC hanya boleh dipilih saat clock-in bila ada pengajuan WFH/WFC yang
// SUDAH DISETUJUI dan mencakup hari ini. Fungsi murni + satu pemuat data.

type SB = any;

export type ModeKerja = "Kantor" | "WFH" | "WFC";
export type StatusRemote = "disetujui" | "menunggu" | null;

/** Rentang tanggal dari kolom approvals.tanggal ("2026-10-06", "2026-10-06 s/d 2026-10-08", …). */
export function rentangIzin(tanggal: unknown): { start: string; end: string } | null {
  const d = String(tanggal ?? "").match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (!d.length) return null;
  const a = d[0] as string;
  const b = (d.length > 1 ? d[1] : d[0]) as string;
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/** Jenis pengajuan → WFH / WFC / null. */
export function jenisRemote(jenis: unknown): "WFH" | "WFC" | null {
  const j = String(jenis ?? "");
  if (/WFC|Work\s*From\s*Ca/i.test(j)) return "WFC";
  if (/WFH|Work\s*From\s*Home/i.test(j)) return "WFH";
  return null;
}

const normStatus = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** Status pengajuan WFH & WFC untuk hari ini (disetujui menang atas menunggu). */
export function statusRemoteHariIni(pengajuan: any[] | null | undefined, hariIni: string): Record<"WFH" | "WFC", StatusRemote> {
  const out: Record<"WFH" | "WFC", StatusRemote> = { WFH: null, WFC: null };
  for (const r of pengajuan || []) {
    const k = jenisRemote(r?.jenis);
    if (!k) continue;
    const rg = rentangIzin(r?.tanggal);
    if (!rg || hariIni < rg.start || hariIni > rg.end) continue;
    const st = normStatus(r?.status);
    if (st === "disetujui") out[k] = "disetujui";
    else if (st === "menunggu" && out[k] !== "disetujui") out[k] = "menunggu";
  }
  return out;
}

/** Mode bawaan saat membuka kamera clock-in: WFH/WFC yang disetujui hari ini, selain itu Kantor. */
export function modeBawaan(st: Record<"WFH" | "WFC", StatusRemote>): ModeKerja {
  if (st.WFH === "disetujui" && st.WFC !== "disetujui") return "WFH";
  if (st.WFC === "disetujui" && st.WFH !== "disetujui") return "WFC";
  if (st.WFH === "disetujui") return "WFH";
  return "Kantor";
}

/** Keterangan di bawah pilihan lokasi. */
export function keteranganRemote(st: Record<"WFH" | "WFC", StatusRemote>): string {
  const menunggu = (["WFH", "WFC"] as const).filter((k) => st[k] === "menunggu");
  if (st.WFH === "disetujui" || st.WFC === "disetujui") return "";
  if (menunggu.length) return `Pengajuan ${menunggu.join("/")} hari ini masih menunggu persetujuan HRD.`;
  return "WFH/WFC aktif hanya bila pengajuan hari ini sudah disetujui HRD.";
}

/**
 * Pengajuan WFH/WFC milik karyawan ini (terbaru dulu). Dipanggil ulang setiap
 * kamera clock-in dibuka, supaya persetujuan HR yang baru masuk langsung terbaca
 * tanpa memuat ulang halaman. Gagal → null (pemanggil memakai data lama).
 */
export async function muatPengajuanRemote(supabase: SB, idKaryawan: string): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from("approvals")
      .select("id, idKaryawan, jenis, tanggal, status")
      .eq("idKaryawan", idKaryawan)
      .in("status", ["Disetujui", "Menunggu"])
      .order("id", { ascending: false })
      .limit(100);
    if (error) return null;
    return (data || []).filter((r: any) => jenisRemote(r.jenis));
  } catch {
    return null;
  }
}
