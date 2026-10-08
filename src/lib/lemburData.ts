// src/lib/lemburData.ts
// Akses data KOMPENSASI LEMBUR (Supabase) — dipakai halaman absen karyawan
// (Kehadiran & Dasbor) dan admin (Dasbor, Kehadiran). Aturannya ada di lib/lembur.ts.
//
//   tandaiLembur / batalkanLembur   : HR/manajer (RLS pp_staf) — upsert tabel `lembur`,
//                                     lalu nilai ulang absen hari kompensasi (koreksi tanggal lampau).
//   catatClockOut                   : karyawan — simpan waktuKeluar + lembur_menit sekaligus.
//   muatKompensasiHariIni           : karyawan — kompensasi yang berlaku untuk hari ini.
import { ambilAturanJamKerja } from "./jamKerja";
import { pushNotify } from "@/lib/push";
import { muatPetaSekitar } from "./hariLiburData";
import type { PetaLibur } from "./hariLibur";
import {
  hariKerjaBerikutnya, hariLemburUntuk, jamPulangHariIni, jamWajibPulang, kompensasiAktif, labelKompensasi, lemburSah,
  menitLembur, nilaiMasuk, tandaAktif, type AbsenRingkas, type Kompensasi, type KompensasiAktif, type TandaLembur,
} from "./lembur";

type SB = any;
export type HasilNilaiUlang = { hariKompensasi: string; sah: boolean; lemburMenit: number | null; statusLama: string | null; statusBaru: string | null; diubah: boolean };

const KOLOM = "id, idKaryawan, nama, tanggal, kompensasi, catatan, ditandai_oleh, ditandai_pada, dibatalkan_pada, dibatalkan_oleh";
const rapikanTanda = (t: any): TandaLembur => ({ ...t, tanggal: String(t.tanggal).slice(0, 10) });

/** Catat ke audit_log (aktor = sesi yang login); gagal mencatat tidak menggagalkan aksi. */
async function catatAudit(sb: SB, action: string, target?: string, detail?: string) {
  try {
    const { data } = await sb.auth.getUser();
    await sb.from("audit_log").insert([{ actor: data?.user?.email || "sistem", action, target: target || null, detail: detail || null }]);
  } catch { /* diamkan */ }
}

export async function muatTandaLembur(sb: SB, o: { idKaryawan?: string; dari: string; sampai: string; termasukBatal?: boolean }): Promise<TandaLembur[]> {
  try {
    let q = sb.from("lembur").select(KOLOM).gte("tanggal", o.dari).lte("tanggal", o.sampai);
    if (o.idKaryawan) q = q.eq("idKaryawan", o.idKaryawan);
    if (!o.termasukBatal) q = q.is("dibatalkan_pada", null);
    const { data, error } = await q.order("tanggal", { ascending: false });
    if (error) return [];
    return ((data || []) as any[]).map(rapikanTanda);
  } catch { return []; }
}

/** Tanda lembur AKTIF seorang karyawan pada satu tanggal (null bila tidak ada / dibatalkan). */
export async function muatTandaHari(sb: SB, idKaryawan: string, tanggal: string): Promise<TandaLembur | null> {
  const d = await muatTandaLembur(sb, { idKaryawan, dari: tanggal, sampai: tanggal });
  return d.find(tandaAktif) || null;
}

/** Kompensasi yang berlaku hari ini untuk satu karyawan (lihat lembur.kompensasiAktif). */
export async function muatKompensasiHariIni(sb: SB, idKaryawan: string, hariIni: string, absenHariIni?: AbsenRingkas | null): Promise<KompensasiAktif | null> {
  const peta = await muatPetaSekitar(sb, hariIni);
  const hari = hariLemburUntuk(hariIni, peta);
  if (!hari.length) return null;
  let tanda = await muatTandaLembur(sb, { idKaryawan, dari: hari[hari.length - 1], sampai: hari[0] });
  if (!tanda.length) return null;
  // Satu tanda = satu pemakaian: tanda yang kompensasinya sudah terpakai di tanggal LAIN
  // (mis. daftar hari libur diubah setelahnya) tidak ditawarkan lagi.
  try {
    const { data: dipakai } = await sb.from("attendance").select("tanggal, kompensasi_dari").eq("idKaryawan", idKaryawan).in("kompensasi_dari", tanda.map((t) => t.tanggal));
    const diTempatLain = new Set(((dipakai || []) as any[]).filter((r) => String(r.tanggal).slice(0, 10) !== hariIni).map((r) => String(r.kompensasi_dari).slice(0, 10)));
    tanda = tanda.filter((t) => !diTempatLain.has(t.tanggal));
    if (!tanda.length) return null;
  } catch { /* kolom belum ada → tanpa saringan */ }
  const absenLembur: Record<string, AbsenRingkas | null> = {};
  try {
    const { data } = await sb.from("attendance").select("id, tanggal, waktuMasuk, waktuKeluar, jamPulangSeharusnya, lembur_menit").eq("idKaryawan", idKaryawan).in("tanggal", tanda.map((t) => t.tanggal));
    (data || []).forEach((a: any) => { absenLembur[String(a.tanggal).slice(0, 10)] = a; });
  } catch { /* tanpa absen → tidak sah */ }
  return kompensasiAktif({ hariIni, tanda, absenLembur, absenHariIni, peta });
}

/** Galat PostgREST/Postgres "kolom tidak ada" — lembur.sql belum dijalankan. */
const kolomBelumAda = (err: any) => {
  const code = String(err?.code || ""), msg = String(err?.message || "");
  return code === "PGRST204" || code === "42703" || /column .* does not exist|Could not find the '.*' column/i.test(msg);
};

/**
 * Clock-out: simpan waktuKeluar + lembur_menit dalam satu update. Mengembalikan menit lembur.
 * Bila kolom lembur belum ada (lembur.sql belum dijalankan) → clock-out tetap tersimpan
 * tanpa lembur_menit dan mengembalikan null (fitur lembur sekadar nonaktif).
 */
export async function catatClockOut(sb: SB, att: AbsenRingkas & { id: any }, waktuKeluar: string, jamKeluar: string): Promise<number | null> {
  const menit = menitLembur(waktuKeluar, jamWajibPulang(att, jamKeluar));
  const { error } = await sb.from("attendance").update({ waktuKeluar, lembur_menit: menit }).eq("id", att.id);
  if (!error) return menit;
  if (!kolomBelumAda(error)) throw error;
  const { error: e2 } = await sb.from("attendance").update({ waktuKeluar }).eq("id", att.id);
  if (e2) throw e2;
  return null;
}

/** Jadwal seorang karyawan (data karyawan + cadangan Pengaturan). */
export async function jadwalKaryawan(sb: SB, idKaryawan: string) {
  const aturan = await ambilAturanJamKerja(sb);
  let e: any = null;
  try { const r = await sb.from("employees").select("jamMasuk, jamKeluar, toleransiTelat, fleksibel, user_id").eq("idKaryawan", idKaryawan).maybeSingle(); e = r?.data || null; } catch { e = null; }
  return {
    jamMasuk: e?.jamMasuk || aturan.jamMasuk,
    jamKeluar: e?.jamKeluar || aturan.jamPulang,
    toleransi: e?.toleransiTelat != null ? Number(e.toleransiTelat) : aturan.toleransiMenit,
    durasiJam: aturan.durasiJam,
    fleksibel: e?.fleksibel === true,
    user_id: (e?.user_id as string | null) || null,
  };
}

/**
 * Nilai ulang hari kompensasi sebuah tanda (koreksi tanggal lampau / pembatalan):
 * hitung lembur_menit hari lembur bila belum ada, lalu tulis status/kompensasi/jam pulang
 * pada absen hari kerja berikutnya bila sudah ada clock-in. Idempoten.
 */
export async function nilaiUlangHariKompensasi(sb: SB, tanda: TandaLembur, petaLibur?: PetaLibur | null): Promise<HasilNilaiUlang> {
  const peta = petaLibur ?? await muatPetaSekitar(sb, tanda.tanggal);
  let hariK = hariKerjaBerikutnya(tanda.tanggal, peta);
  // Kompensasi tanda ini sudah terpakai di tanggal lain (daftar hari libur diubah setelahnya)?
  // → absen itulah yang dinilai ulang, agar satu tanda tidak terpakai dua kali / tertinggal.
  try {
    const { data: terpakai } = await sb.from("attendance").select("tanggal").eq("idKaryawan", tanda.idKaryawan).eq("kompensasi_dari", tanda.tanggal);
    const lain = ((terpakai || []) as any[]).map((r) => String(r.tanggal).slice(0, 10)).find((t) => t !== hariK);
    if (lain && !((terpakai || []) as any[]).some((r) => String(r.tanggal).slice(0, 10) === hariK)) hariK = lain;
  } catch { /* kolom belum ada → pakai hari kerja berikutnya */ }
  const jadwal = await jadwalKaryawan(sb, tanda.idKaryawan);
  const { data: aL } = await sb.from("attendance").select("*").eq("idKaryawan", tanda.idKaryawan).eq("tanggal", tanda.tanggal).maybeSingle();
  let absenLembur: AbsenRingkas | null = aL || null;
  if (aL?.waktuKeluar && aL.lembur_menit == null) {
    const m = menitLembur(aL.waktuKeluar, jamWajibPulang(aL, jadwal.jamKeluar));
    await sb.from("attendance").update({ lembur_menit: m }).eq("id", aL.id);
    absenLembur = { ...aL, lembur_menit: m };
  }
  const sah = lemburSah(tanda, absenLembur);
  const hasil: HasilNilaiUlang = { hariKompensasi: hariK, sah, lemburMenit: absenLembur?.lembur_menit ?? null, statusLama: null, statusBaru: null, diubah: false };

  const { data: aK } = await sb.from("attendance").select("*").eq("idKaryawan", tanda.idKaryawan).eq("tanggal", hariK).maybeSingle();
  if (!aK?.waktuMasuk) return hasil;
  const dariLama = aK.kompensasi_dari ? String(aK.kompensasi_dari).slice(0, 10) : null;
  if (dariLama && dariLama !== tanda.tanggal) return hasil;   // hari itu memakai tanda lain → jangan sentuh

  let kompensasi: Kompensasi | null = sah ? tanda.kompensasi : null;
  let dariBaru: string | null = kompensasi ? tanda.tanggal : null;
  // Tidak ada yang diterapkan (tanda tidak sah) dan tidak ada yang perlu dipulihkan (hari itu
  // belum memakai tanda ini) → jangan sentuh absen sama sekali (keputusan HR lain tetap utuh).
  if (!kompensasi && !dariLama) return hasil;
  if (!kompensasi) {
    // Tanda ini dicabut tetapi tanda sah lain (mis. Jumat & Sabtu → Senin yang sama) masih ada → pakai itu.
    const alt = await tandaSahLain(sb, tanda, hariK, peta);
    if (alt) { kompensasi = alt.kompensasi; dariBaru = alt.tanggal; }
  }
  const nilai = nilaiMasuk({ waktuMasuk: aK.waktuMasuk, jamMasuk: jadwal.jamMasuk, toleransi: jadwal.toleransi, fleksibel: jadwal.fleksibel, modeKerja: aK.mode_kerja || "Kantor", kompensasi });
  const baru: Record<string, any> = { status: nilai.status, kompensasi_lembur: kompensasi, kompensasi_dari: dariBaru };
  // jamPulangSeharusnya hanya disentuh bila kompensasi memang memengaruhinya: saat diterapkan,
  // saat memulihkan pulang_cepat, atau saat status berubah (telat ↔ tepat mengubah jam wajib pulang).
  if (kompensasi || aK.kompensasi_lembur === "pulang_cepat" || (aK.status || null) !== nilai.status) {
    baru.jamPulangSeharusnya = jamPulangHariIni({ waktuMasuk: aK.waktuMasuk, jamMasuk: jadwal.jamMasuk, jamKeluar: jadwal.jamKeluar, toleransi: jadwal.toleransi, durasiJam: jadwal.durasiJam, fleksibel: jadwal.fleksibel, telat: nilai.telat, kompensasi });
  }
  hasil.statusLama = aK.status || null;
  hasil.statusBaru = baru.status;
  const sama = aK.status === baru.status && (aK.kompensasi_lembur || null) === baru.kompensasi_lembur && dariLama === baru.kompensasi_dari
    && (!("jamPulangSeharusnya" in baru) || (aK.jamPulangSeharusnya || null) === (baru.jamPulangSeharusnya || null));
  if (sama) return hasil;
  const { error } = await sb.from("attendance").update(baru).eq("id", aK.id);
  if (error) throw error;
  hasil.diubah = true;
  if (aK.status === "Terlambat" && baru.status === "Tepat Waktu") {
    // Pengajuan Izin Terlambat otomatis yang terlanjur dibuat pagi itu → disetujui agar hilang dari antrean.
    try {
      const { data: izin } = await sb.from("approvals").select("id, alasan").eq("idKaryawan", tanda.idKaryawan).eq("tanggal", hariK).eq("jenis", "Izin Terlambat").eq("status", "Menunggu");
      for (const r of izin || []) {
        await sb.from("approvals").update({ status: "Disetujui", alasan: `${String(r.alasan || "").trim()} (kompensasi lembur)`.trim() }).eq("id", r.id);
      }
    } catch { /* pengajuan tidak wajib ada */ }
  } else if (aK.status === "Tepat Waktu" && baru.status === "Terlambat") {
    // Kompensasi dicabut (tanda dibatalkan / tidak sah lagi) → Izin Terlambat yang tadi disetujui
    // OTOMATIS oleh sistem (bertanda "(kompensasi lembur)") kembali Menunggu untuk ditinjau HR.
    // Izin yang disetujui HR secara manual (tanpa tanda itu) tidak disentuh.
    try {
      const { data: izin } = await sb.from("approvals").select("id, alasan").eq("idKaryawan", tanda.idKaryawan).eq("tanggal", hariK).eq("jenis", "Izin Terlambat").eq("status", "Disetujui");
      for (const r of izin || []) {
        const alasan = String(r.alasan || "");
        if (!/\s*\(kompensasi lembur\)\s*$/.test(alasan)) continue;
        await sb.from("approvals").update({ status: "Menunggu", alasan: alasan.replace(/\s*\(kompensasi lembur\)\s*$/, "").trim() }).eq("id", r.id);
      }
    } catch { /* pengajuan tidak wajib ada */ }
  }
  return hasil;
}

/** Tanda aktif & sah LAIN (bukan `tanda`) yang hari kompensasinya = hariK; terbaru dulu. */
async function tandaSahLain(sb: SB, tanda: TandaLembur, hariK: string, peta: PetaLibur | null): Promise<TandaLembur | null> {
  const hari = hariLemburUntuk(hariK, peta).filter((d) => d !== tanda.tanggal);
  if (!hari.length) return null;
  const daftar = (await muatTandaLembur(sb, { idKaryawan: tanda.idKaryawan, dari: hari[hari.length - 1], sampai: hari[0] }))
    .filter((t) => t.tanggal !== tanda.tanggal && hari.includes(t.tanggal) && tandaAktif(t));
  if (!daftar.length) return null;
  const absen: Record<string, AbsenRingkas> = {};
  try {
    const { data } = await sb.from("attendance").select("tanggal, lembur_menit").eq("idKaryawan", tanda.idKaryawan).in("tanggal", daftar.map((t) => t.tanggal));
    (data || []).forEach((a: any) => { absen[String(a.tanggal).slice(0, 10)] = a; });
  } catch { return null; }
  return daftar.sort((a, b) => b.tanggal.localeCompare(a.tanggal)).find((t) => lemburSah(t, absen[t.tanggal])) || null;
}

/** HR/manajer menandai lembur (tanggal hari ini atau lampau) + memilih kompensasi. */
export async function tandaiLembur(sb: SB, p: { idKaryawan: string; nama?: string | null; tanggal: string; kompensasi: Kompensasi; catatan?: string; oleh: string }) {
  try {
    const baris = {
      idKaryawan: p.idKaryawan, nama: p.nama || null, tanggal: p.tanggal, kompensasi: p.kompensasi,
      catatan: String(p.catatan || "").trim() || null, ditandai_oleh: p.oleh, ditandai_pada: new Date().toISOString(),
      dibatalkan_pada: null, dibatalkan_oleh: null,
    };
    const { data, error } = await sb.from("lembur").upsert(baris, { onConflict: "idKaryawan,tanggal" }).select(KOLOM).single();
    if (error) return { ok: false as const, pesan: error.message || "Gagal menandai lembur." };
    const tanda = rapikanTanda(data);
    const peta = await muatPetaSekitar(sb, tanda.tanggal);
    // Tanda SUDAH tersimpan; penilaian ulang absen hari kompensasi boleh gagal (mis. hak tulis
    // manajer pada attendance) tanpa membuat tanda terlihat gagal — dilaporkan sebagai peringatan.
    let hasil: HasilNilaiUlang = { hariKompensasi: hariKerjaBerikutnya(tanda.tanggal, peta), sah: false, lemburMenit: null, statusLama: null, statusBaru: null, diubah: false };
    let peringatan: string | null = null;
    try { hasil = await nilaiUlangHariKompensasi(sb, tanda, peta); }
    catch (e: any) { peringatan = `Tanda tersimpan, tetapi absen ${hasil.hariKompensasi} belum bisa dinilai ulang: ${e?.message || e}`; }
    const jadwal = await jadwalKaryawan(sb, p.idKaryawan);
    if (jadwal.user_id) {
      pushNotify(sb, {
        memberIds: [jadwal.user_id],
        title: `Ditandai lembur ${p.tanggal}`,
        body: `Hari kerja berikutnya ${labelKompensasi(p.kompensasi, jadwal.jamMasuk, jadwal.jamKeluar)} — berlaku bila clock-out ≥ 1 jam setelah jam pulang.`,
        url: "/user/kehadiran", tag: "lembur",
      });
    }
    await catatAudit(sb, "Tandai Lembur", `${p.nama || p.idKaryawan} · ${p.tanggal}`, `${p.kompensasi}${hasil.diubah ? ` · ${hasil.hariKompensasi}: ${hasil.statusLama} → ${hasil.statusBaru}` : ""}${peringatan ? " · nilai ulang gagal" : ""}`);
    return { ok: true as const, tanda, hasil, peringatan };
  } catch (e: any) {
    return { ok: false as const, pesan: e?.message || "Gagal menandai lembur." };
  }
}

/** Batalkan tanda lembur; absen hari kompensasi dinilai ulang tanpa kompensasi. */
export async function batalkanLembur(sb: SB, tanda: TandaLembur, oleh: string) {
  try {
    const kini = new Date().toISOString();
    const { error } = await sb.from("lembur").update({ dibatalkan_pada: kini, dibatalkan_oleh: oleh }).eq("id", tanda.id);
    if (error) return { ok: false as const, pesan: error.message || "Gagal membatalkan." };
    const peta = await muatPetaSekitar(sb, tanda.tanggal);
    let hasil: HasilNilaiUlang = { hariKompensasi: hariKerjaBerikutnya(tanda.tanggal, peta), sah: false, lemburMenit: null, statusLama: null, statusBaru: null, diubah: false };
    let peringatan: string | null = null;
    try { hasil = await nilaiUlangHariKompensasi(sb, { ...tanda, dibatalkan_pada: kini, dibatalkan_oleh: oleh }, peta); }
    catch (e: any) { peringatan = `Tanda dibatalkan, tetapi absen ${hasil.hariKompensasi} belum bisa dinilai ulang: ${e?.message || e}`; }
    const jadwal = await jadwalKaryawan(sb, tanda.idKaryawan);
    if (jadwal.user_id) {
      pushNotify(sb, {
        memberIds: [jadwal.user_id],
        title: `Tanda lembur ${tanda.tanggal} dibatalkan`,
        body: hasil.diubah ? `Status absen ${hasil.hariKompensasi} dinilai ulang: ${hasil.statusBaru}.` : "Kompensasi lembur tidak berlaku lagi.",
        url: "/user/kehadiran", tag: "lembur",
      });
    }
    await catatAudit(sb, "Batalkan Lembur", `${tanda.nama || tanda.idKaryawan} · ${tanda.tanggal}`, hasil.diubah ? `${hasil.hariKompensasi}: ${hasil.statusLama} → ${hasil.statusBaru}` : peringatan ? "nilai ulang gagal" : undefined);
    return { ok: true as const, hasil, peringatan };
  } catch (e: any) {
    return { ok: false as const, pesan: e?.message || "Gagal membatalkan." };
  }
}
