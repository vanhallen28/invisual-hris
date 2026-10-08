// src/lib/hariLiburData.ts
// Akses tabel `hari_libur` (Supabase). Aturannya di lib/hariLibur.ts.
// Bila hari-libur.sql belum dijalankan / gagal → [] (aplikasi berperilaku seperti
// sebelumnya: hanya Sabtu–Minggu yang libur).
import { buatPetaLibur, rapikanLibur, rentangSekitar, type HariLibur, type JenisLibur, type PetaLibur } from "./hariLibur";

type SB = any;
const KOLOM = "tanggal, nama, jenis, libur, diubah_oleh, diubah_pada";

/** Galat "tabel tidak ada" (PGRST205 / 42P01) — hari-libur.sql belum dijalankan. */
export const tabelLiburBelumAda = (err: any) => {
  const code = String(err?.code || ""), msg = String(err?.message || "");
  return code === "PGRST205" || code === "42P01" || /relation .*hari_libur.* does not exist|Could not find the table/i.test(msg);
};

export async function muatHariLibur(sb: SB, dari: string, sampai: string): Promise<HariLibur[]> {
  try {
    const { data, error } = await sb.from("hari_libur").select(KOLOM).gte("tanggal", dari).lte("tanggal", sampai).order("tanggal", { ascending: true });
    if (error) return [];
    return ((data || []) as any[]).map(rapikanLibur).filter(Boolean) as HariLibur[];
  } catch { return []; }
}

export async function muatPetaLibur(sb: SB, dari: string, sampai: string): Promise<PetaLibur> {
  return buatPetaLibur(await muatHariLibur(sb, dari, sampai));
}

/** Peta libur ±31 hari dari sebuah tanggal (lembur: hari kompensasi melewati libur). */
export const muatPetaSekitar = (sb: SB, iso: string) => { const r = rentangSekitar(iso); return muatPetaLibur(sb, r.dari, r.sampai); };

/** Pengaturan HR: semua baris (ada = tabel ada). `ada: false` → tampilkan petunjuk SQL. */
export async function muatSemuaLibur(sb: SB): Promise<{ ada: boolean; baris: HariLibur[]; pesan?: string }> {
  try {
    const { data, error } = await sb.from("hari_libur").select(KOLOM).order("tanggal", { ascending: true });
    if (error) return { ada: !tabelLiburBelumAda(error), baris: [], pesan: error.message };
    return { ada: true, baris: ((data || []) as any[]).map(rapikanLibur).filter(Boolean) as HariLibur[] };
  } catch (e: any) { return { ada: false, baris: [], pesan: e?.message }; }
}

async function catatAudit(sb: SB, action: string, target: string, detail?: string) {
  try {
    const { data } = await sb.auth.getUser();
    await sb.from("audit_log").insert([{ actor: data?.user?.email || "sistem", action, target, detail: detail || null }]);
  } catch { /* diamkan */ }
}
const oleh = async (sb: SB) => { try { const { data } = await sb.auth.getUser(); return data?.user?.email || "HR"; } catch { return "HR"; } };

type Hasil = { ok: true } | { ok: false; pesan: string };

/** Sakelar cuti bersama / libur kantor: libur (true) atau masuk kerja (false). */
export async function setelLibur(sb: SB, x: HariLibur, libur: boolean): Promise<Hasil> {
  if (x.jenis === "nasional") return { ok: false, pesan: "Libur nasional selalu libur." };
  const { data, error } = await sb.from("hari_libur").update({ libur, diubah_oleh: await oleh(sb), diubah_pada: new Date().toISOString() }).eq("tanggal", x.tanggal).select("tanggal");
  if (error) return { ok: false, pesan: error.message };
  if (!data || !data.length) return { ok: false, pesan: "Tidak tersimpan — hanya HR/manajer yang bisa mengubah." };
  await catatAudit(sb, "Ubah Hari Libur", `${x.tanggal} · ${x.nama}`, libur ? "Libur" : "Masuk kerja");
  return { ok: true };
}

export async function tambahLibur(sb: SB, p: { tanggal: string; nama: string; jenis: JenisLibur }): Promise<Hasil> {
  const nama = String(p.nama || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.tanggal)) return { ok: false, pesan: "Tanggal belum diisi." };
  if (!nama) return { ok: false, pesan: "Nama hari libur belum diisi." };
  if (nama.length > 120) return { ok: false, pesan: "Nama terlalu panjang (maks. 120 karakter)." };
  const { data, error } = await sb.from("hari_libur").insert([{ tanggal: p.tanggal, nama, jenis: p.jenis, libur: true, diubah_oleh: await oleh(sb) }]).select("tanggal");
  if (error) return { ok: false, pesan: String(error.code) === "23505" ? "Tanggal itu sudah ada di daftar." : error.message };
  if (!data || !data.length) return { ok: false, pesan: "Tidak tersimpan — hanya HR/manajer yang bisa menambah." };
  await catatAudit(sb, "Tambah Hari Libur", `${p.tanggal} · ${nama}`, p.jenis);
  return { ok: true };
}

export async function hapusLibur(sb: SB, x: HariLibur): Promise<Hasil> {
  const { data, error } = await sb.from("hari_libur").delete().eq("tanggal", x.tanggal).select("tanggal");
  if (error) return { ok: false, pesan: error.message };
  if (!data || !data.length) return { ok: false, pesan: "Tidak terhapus — hanya HR/manajer yang bisa menghapus." };
  await catatAudit(sb, "Hapus Hari Libur", `${x.tanggal} · ${x.nama}`, x.jenis);
  return { ok: true };
}
