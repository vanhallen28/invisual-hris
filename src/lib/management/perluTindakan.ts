// src/lib/management/perluTindakan.ts
// Daftar "Perlu tindakan saya" per peran (murni; dipakai panel Ringkasan dan, di P2, pengingat pagi).
// Aturan P1 (rencana Task 8) — P2 (Task 12) di bagian bawah fungsi:
//   PM/SM        → "Teruskan usulan" untuk tiap usulan berstatus diajukan
//   Leader/HR    → "Isi cek dampak" untuk baris dampak divisinya yang masih kosong (mendesak bila tenggat < 24 jam)
//   SM           → "Putuskan" untuk siap_diputuskan & berlaku_darurat
//   PM           → "Terbitkan Pedoman" bila ada usulan disetujui > 1 hari kerja (9 jam kerja) dan belum tertaut ke versi
//   Leader/HR/SM → "Pedoman yang belum Anda konfirmasi"
/* eslint-disable @typescript-eslint/no-explicit-any -- baris tabel diteruskan dari pemanggil */
import type { PetaLibur } from "../hariLibur";
import type { PeranManagement } from "./akses";
import { JAM_PER_HARI, tambahJamKerja } from "./hariKerja";

export type ItemTindakan = { kunci: string; judul: string; ket?: string; tautan: string; tenggat?: string; mendesak: boolean };
export type DataTindakan = {
  usulan: any[];                    // baris mgmt_usulan
  dampak: any[];                    // baris mgmt_usulan_dampak
  tautanPedoman: string[];          // usulan_id yang sudah tertaut ke versi mana pun
  pedomanBelumDibaca: boolean;      // versi berlaku belum dikonfirmasi pengguna
  peta?: PetaLibur | null;          // hari libur untuk hitungan jam kerja
  // P2 (Task 12): serahTerima, ringkasanHariIni, sudahKirimRingkasan, hariIniDihitung
  serahTerima?: any[];
  ringkasanHariIni?: any[];
  sudahKirimRingkasan?: boolean;
  hariIniDihitung?: boolean;
};

const LEADER = ["leader_sosmed", "leader_service", "leader_marketplace"];
const DIV: Record<string, string> = { sosmed: "Sosmed", service: "Service", marketplace: "Marketplace", hr: "HR" };

export function hitungPerluTindakan(d: DataTindakan, peran: PeranManagement[], divisi: string[], sekarang: Date): ItemTindakan[] {
  const punya = (...p: string[]) => peran.some((x) => p.includes(x));
  const out: ItemTindakan[] = [];
  const now = sekarang.getTime();
  const lewatHariKerja = (iso: string | null | undefined) => !!iso && tambahJamKerja(new Date(iso), JAM_PER_HARI, d.peta).getTime() < now;
  const ke = (u: any) => `?tab=usulan&id=${u.id}`;

  if (punya("pm", "studio_manager")) {
    for (const u of d.usulan.filter((x) => x.status === "diajukan"))
      out.push({ kunci: `teruskan:${u.id}`, judul: `Teruskan usulan ${u.nomor}`, ket: u.judul, tautan: ke(u), tenggat: "Teruskan ≤ 1 hari kerja", mendesak: lewatHariKerja(u.dibuat_pada) });
  }
  if (punya("hr", ...LEADER)) {
    const status = new Map(d.usulan.map((u) => [u.id, u]));
    for (const r of d.dampak) {
      const u = status.get(r.usulan_id);
      if (!u || u.status !== "cek_dampak" || r.nilai != null || !divisi.includes(r.divisi)) continue;
      const sisa = u.tenggat_dampak ? Date.parse(u.tenggat_dampak) - now : Infinity;
      out.push({ kunci: `dampak:${u.id}:${r.divisi}`, judul: `Isi cek dampak ${u.nomor} (${DIV[r.divisi] || r.divisi})`, ket: u.judul, tautan: ke(u), tenggat: u.tenggat_dampak || undefined, mendesak: sisa < 24 * 3_600_000 });
    }
  }
  if (punya("studio_manager")) {
    for (const u of d.usulan.filter((x) => x.status === "siap_diputuskan" || x.status === "berlaku_darurat"))
      out.push({ kunci: `putuskan:${u.id}`, judul: `Putuskan ${u.nomor}`, ket: u.judul, tautan: ke(u), mendesak: u.status === "berlaku_darurat" });
  }
  if (punya("pm")) {
    const tertaut = new Set(d.tautanPedoman);
    for (const u of d.usulan.filter((x) => x.status === "disetujui" && !tertaut.has(x.id) && lewatHariKerja(x.diputuskan_pada)))
      out.push({ kunci: `terbitkan:${u.id}`, judul: "Terbitkan Pedoman", ket: `${u.nomor} disetujui lebih dari 1 hari kerja lalu dan belum tertaut ke versi`, tautan: "?tab=pedoman&sub=editor", tenggat: "Perbarui ≤ 2 hari kerja", mendesak: true });
  }
  if (punya("hr", "studio_manager", ...LEADER) && d.pedomanBelumDibaca)
    out.push({ kunci: "pedoman:baca", judul: "Pedoman yang belum Anda konfirmasi", ket: "Baca sampai akhir, lalu tekan konfirmasi", tautan: "?tab=pedoman&sub=baca", mendesak: false });

  // ── P2 (hanya bila datanya dimuat, yaitu management-p2.sql sudah dijalankan) ──
  const st = d.serahTerima || [];
  const lewat = (k: any) => Date.parse(k.tenggat) < now;
  if (punya(...LEADER) && d.hariIniDihitung && d.sudahKirimRingkasan === false) {
    const jamWib = new Date(now + 7 * 3_600_000).getUTCHours();
    out.push({ kunci: "ringkasan:hari-ini", judul: "Isi Ringkasan Harian", ket: "Maks. 3 butir Selesai & Hambatan", tautan: "?tab=harian", tenggat: "Sebelum 18.00 WIB", mendesak: jamWib >= 17 });
  }
  if (punya(...LEADER)) {   // kartu ke divisi saya, atau yang penanggung jawabnya peran saya (mis. calon klien Sosmed → Dea, PJ Leader Sosmed)
    for (const k of st.filter((x) => x.status === "berjalan" && (divisi.includes(x.ke_divisi) || (LEADER.includes(x.penanggung_jawab_peran) && peran.includes(x.penanggung_jawab_peran)))))
      out.push({ kunci: `st-masuk:${k.id}`, judul: divisi.includes(k.ke_divisi) ? "Serah terima masuk" : "Serah terima tanggung jawab Anda", ket: k.judul, tautan: "?tab=serah-terima", tenggat: k.tenggat, mendesak: lewat(k) });
  }
  if (punya("pm")) {
    for (const k of st.filter((x) => x.status === "berjalan" && lewat(x) && !x.ditindaklanjuti_pada))
      out.push({ kunci: `st-terlambat:${k.id}`, judul: "Kartu terlambat", ket: `${k.judul} — tandai "Sudah ditindaklanjuti" dengan catatan`, tautan: "?tab=serah-terima", tenggat: k.tenggat, mendesak: true });
  }
  const sudah = new Set(out.map((x) => x.kunci));
  for (const r of d.ringkasanHariIni || []) {
    if (!r.butuh_divisi || !(punya("pm") || divisi.includes(r.butuh_divisi)) || sudah.has(`bantuan:${r.id}`)) continue;
    sudah.add(`bantuan:${r.id}`);
    const hambatan = (r.hambatan || []).join("; ");
    out.push({ kunci: `bantuan:${r.id}`, judul: `Butuh bantuan dari ${DIV[r.butuh_divisi] || r.butuh_divisi}`, ket: `${DIV[r.divisi] || r.divisi}${hambatan ? `: ${hambatan}` : ""}`, tautan: "?tab=harian", mendesak: false });
  }
  if (punya("owner")) {
    for (const k of st.filter((x) => x.status === "berjalan" && x.jenis === "review_dea"))
      out.push({ kunci: `review:${k.id}`, judul: "Review Dea menunggu", ket: k.judul, tautan: "?tab=serah-terima", tenggat: k.tenggat, mendesak: lewat(k) });
  }
  return out;
}
