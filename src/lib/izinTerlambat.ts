// src/lib/izinTerlambat.ts
// Aturan pemilik (9 Okt 2026): Izin Terlambat yang di-"ACC normal" HR (keterlambatan dimaafkan,
// pulang jam normal) → absen hari itu dihitung TEPAT WAKTU di semua tempat (status tersimpan).
// "ACC +jam" (wajib ganti jam) tetap Terlambat. Berlaku untuk keputusan SEJAK fitur ini dipasang:
// keputusan baru ditandai `approvals.acc_tepat_waktu = true` (lembur-kompensasi-acc.sql), sehingga
// ACC normal lama (sebelum fitur) tidak ikut mengubah data saat absennya dinilai ulang.
type SB = any;

/** Nilai `approvals.keputusanPulang` untuk ACC normal. */
export const ACC_NORMAL = "normal";

/** Galat "kolom tidak ada" (PostgREST/Postgres). */
const kolomTiada = (err: any) => {
  const code = String(err?.code || ""), msg = String(err?.message || "");
  return code === "PGRST204" || code === "42703" || /column .* does not exist|Could not find the '.*' column/i.test(msg);
};

/**
 * Simpan keputusan pengajuan. ACC normal Izin Terlambat → tandai acc_tepat_waktu = true.
 * Kolom belum ada (SQL belum dijalankan) → keputusan tetap tersimpan tanpa tanda itu.
 */
export async function simpanKeputusanPengajuan(sb: SB, o: { id: string; status: "Disetujui" | "Ditolak"; keputusan?: "normal" | "sesuai_telat"; jenis?: string | null }) {
  const dasar: Record<string, any> = { status: o.status, ...(o.keputusan ? { keputusanPulang: o.keputusan } : {}) };
  const tepat = o.status === "Disetujui" && o.keputusan === ACC_NORMAL && o.jenis === "Izin Terlambat";
  if (tepat) {
    const { error } = await sb.from("approvals").update({ ...dasar, acc_tepat_waktu: true }).eq("id", o.id);
    if (!error || !kolomTiada(error)) return { error };
  }
  return sb.from("approvals").update(dasar).eq("id", o.id);
}

/** Ada Izin Terlambat yang di-ACC normal (sejak fitur ini) untuk karyawan & tanggal itu? */
export async function izinTelatAccNormal(sb: SB, idKaryawan: string, tanggal: string): Promise<boolean> {
  try {
    const { data, error } = await sb.from("approvals").select("id, keputusanPulang, acc_tepat_waktu")
      .eq("idKaryawan", idKaryawan).eq("tanggal", tanggal).eq("jenis", "Izin Terlambat").eq("status", "Disetujui");
    if (error) return false;   // kolom belum ada → perlindungan nonaktif (aturan lama)
    return ((data || []) as any[]).some((r) => r?.keputusanPulang === ACC_NORMAL && r?.acc_tepat_waktu === true);
  } catch { return false; }
}
