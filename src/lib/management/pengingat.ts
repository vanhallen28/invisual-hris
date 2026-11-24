// src/lib/management/pengingat.ts
// Pengingat pagi Management (08.30 WIB hari kerja, lewat Vercel Cron → /api/management/pengingat).
// Data dimuat dengan klien SERVICE ROLE (server saja). Peran per akun dihitung SAMA dengan mgmt_peran_saya() di SQL:
//   baris mgmt_anggota aktif (user_id / email / emailLogin) + owner (OWNER_EMAILS) + akun @invisual.studio non-owner = SM + PM + HR.
// Gerbang (management-gerbang.sql): sakelar Pengaturan MATI → hanya akun @invisual.studio yang diingatkan.
// Isi per akun = hitungPerluTindakan (sama dengan panel "Perlu tindakan") + pengingat baca Pedoman untuk leader/HR.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types; pengiriman disuntikkan (kirim).
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase & baris tabel */
import type { PetaLibur } from "../hariLibur";
import { isOwnerEmail } from "../owners";
import { DIVISI_LABEL, type PeranManagement } from "./akses";
import { emailStudio, gerbangTerbukaServer } from "./gerbang";
import { adalahHariKerja, isoWib, tambahHariIso, tambahJamKerja } from "./hariKerja";
import { jenisBebasRingkasan, tanggalPengajuan } from "./harian";
import { hitungPerluTindakan, type ItemTindakan } from "./perluTindakan";

/** Jam kerja sejak Pedoman terbit sebelum leader diingatkan soal staf yang belum konfirmasi (target 3 hari kerja). */
export const JAM_PENGINGAT_BACA = 27;
const DIVISI_LEADER = ["sosmed", "service", "marketplace"];

export type KirimFn = (memberIds: string[], isi: { title: string; body: string; url: string; tag: string }) => Promise<{ sent: number }>;
export type HasilPengingat =
  | { ok: true; dikirim: 0; dilewati: "libur" | "belum-dipasang" }
  | { ok: true; dikirim: number; terkirim: number; penerima: { uid: string; kunci: string[]; judul: string[] }[] };

/** Hanya Vercel Cron (header Authorization: Bearer CRON_SECRET). Secret kosong → selalu ditolak. */
export const cronSah = (header: string | null | undefined, rahasia: string | null | undefined): boolean =>
  !!rahasia && rahasia.trim().length > 0 && header === `Bearer ${rahasia}`;

const kecil = (s: unknown) => String(s ?? "").trim().toLowerCase();
async function baca(q: any): Promise<any[] | null> {
  try { const { data, error } = await q; return error ? null : (data || []); } catch { return null; }
}

/** Peta email → uid dan uid → email dari Auth (untuk karyawan yang user_id-nya belum terisi). Gagal → peta kosong. */
async function petaAkun(sb: any): Promise<{ uidDari: Map<string, string>; emailDari: Map<string, string> }> {
  const uidDari = new Map<string, string>(), emailDari = new Map<string, string>();
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      const u = data?.users || [];
      for (const x of u) if (x?.id && x?.email) { uidDari.set(kecil(x.email), x.id); emailDari.set(x.id, kecil(x.email)); }
      if (u.length < 1000) break;
    }
  } catch { /* tanpa peta Auth: hanya akun ber-user_id */ }
  return { uidDari, emailDari };
}

type Orang = { uid: string; idk: string | null; emailAkun: string; peran: Set<PeranManagement>; divisi: Set<string>; divisiStaf: string | null; owner: boolean };

export async function jalankanPengingat(sb: any, kirim: KirimFn, sekarang: Date): Promise<HasilPengingat> {
  const hari = isoWib(sekarang);
  const libur = (await baca(sb.from("hari_libur").select("tanggal, nama, jenis, libur").gte("tanggal", tambahHariIso(hari, -30)).lte("tanggal", tambahHariIso(hari, 14)))) || [];
  const peta: PetaLibur = new Map(libur.map((r: any) => { const t = String(r.tanggal).slice(0, 10); return [t, { ...r, tanggal: t }]; }));
  if (!adalahHariKerja(hari, peta)) return { ok: true, dikirim: 0, dilewati: "libur" };

  const [emp, anggota, usulan, dampak, tautan, versi, staf, st, rh, apr, akun] = await Promise.all([
    baca(sb.from("employees").select("idKaryawan, nama, email, emailLogin, user_id, isAktif, aksesLogin")),
    baca(sb.from("mgmt_anggota").select("email, user_id, peran, divisi, aktif").eq("aktif", true)),
    baca(sb.from("mgmt_usulan").select("*")),
    baca(sb.from("mgmt_usulan_dampak").select("*")),
    baca(sb.from("mgmt_pedoman_usulan").select("usulan_id")),
    baca(sb.from("mgmt_pedoman_versi").select("id, versi, status, diterbitkan_pada").eq("status", "berlaku")),
    baca(sb.from("mgmt_divisi_staf").select("id_karyawan, divisi")),
    baca(sb.from("mgmt_serah_terima").select("*").eq("status", "berjalan")),          // null bila SQL P2 belum dijalankan
    baca(sb.from("mgmt_ringkasan_harian").select("*").eq("tanggal", hari)),
    baca(sb.from("approvals").select("idKaryawan, jenis, tanggal, status").eq("status", "Disetujui").gte("tanggal", tambahHariIso(hari, -180)).lt("tanggal", tambahHariIso(hari, 1))),
    petaAkun(sb),
  ]);
  // Hanya jalan setelah management-p2.sql dijalankan (kode boleh dipasang lebih dulu tanpa mengubah apa pun).
  if (!emp || !anggota || !usulan || st === null || rh === null) return { ok: true, dikirim: 0, dilewati: "belum-dipasang" };

  const terbuka = await gerbangTerbukaServer(sb);
  const berlaku = (versi || [])[0] || null;
  const sudahBaca = new Set(berlaku ? ((await baca(sb.from("mgmt_pedoman_baca").select("user_id").eq("versi_id", berlaku.id))) || []).map((r: any) => String(r.user_id)) : []);
  const divisiStaf = new Map((staf || []).map((r: any) => [String(r.id_karyawan), String(r.divisi)]));

  // ── Orang (akun) beserta peran — cermin mgmt_peran_saya / mgmt_divisi_saya ──
  const orang = new Map<string, Orang>();
  const dikecualikan = new Set<string>();   // uid & email karyawan nonaktif / akses ditutup — tidak pernah dikirimi
  const tambahPeran = (o: Orang, a: any) => {
    o.peran.add(a.peran);
    if (String(a.peran).startsWith("leader_") && a.divisi) o.divisi.add(a.divisi);
  };
  for (const e of emp) {
    const email = [kecil(e.email), kecil(e.emailLogin)].filter(Boolean);
    const uid = e.user_id || email.map((x) => akun.uidDari.get(x)).find(Boolean);
    if (e.isAktif === false || e.aksesLogin === "ditutup") { email.forEach((x) => dikecualikan.add(x)); if (uid) dikecualikan.add(uid); continue; }
    if (!uid) continue;
    const emailAkun = akun.emailDari.get(uid) || kecil(e.emailLogin || e.email);
    const o: Orang = orang.get(uid) || { uid, idk: e.idKaryawan, emailAkun, peran: new Set(), divisi: new Set(), divisiStaf: divisiStaf.get(e.idKaryawan) || null, owner: false };
    o.owner = o.owner || email.some(isOwnerEmail) || isOwnerEmail(emailAkun);
    for (const a of anggota) if (a.aktif !== false && ((a.user_id && a.user_id === uid) || email.includes(kecil(a.email)) || kecil(a.email) === emailAkun)) tambahPeran(o, a);
    if (o.owner) o.peran.add("owner");
    else if (emailAkun.endsWith("@invisual.studio")) (["hr", "pm", "studio_manager"] as PeranManagement[]).forEach((p) => o.peran.add(p));
    orang.set(uid, o);
  }
  for (const a of anggota) {   // anggota ber-user_id tanpa baris karyawan
    if (a.aktif === false || !a.user_id || orang.has(a.user_id) || dikecualikan.has(a.user_id) || dikecualikan.has(kecil(a.email))) continue;
    const o: Orang = { uid: a.user_id, idk: null, emailAkun: akun.emailDari.get(a.user_id) || kecil(a.email), peran: new Set(), divisi: new Set(), divisiStaf: null, owner: false };
    tambahPeran(o, a); orang.set(a.user_id, o);
  }
  // Akun Auth tanpa baris karyawan: owner & @invisual.studio tetap berperan otomatis (sama dengan mgmt_peran_saya).
  for (const [uid, email] of akun.emailDari) {
    if (orang.has(uid) || dikecualikan.has(uid) || dikecualikan.has(email)) continue;
    const owner = isOwnerEmail(email);
    if (!owner && !email.endsWith("@invisual.studio")) continue;
    const o: Orang = { uid, idk: null, emailAkun: email, peran: new Set(), divisi: new Set(), divisiStaf: null, owner };
    for (const a of anggota) if (a.aktif !== false && (a.user_id === uid || kecil(a.email) === email)) tambahPeran(o, a);
    if (owner) o.peran.add("owner"); else (["hr", "pm", "studio_manager"] as PeranManagement[]).forEach((p) => o.peran.add(p));
    orang.set(uid, o);
  }
  for (const o of orang.values()) if (o.peran.has("hr")) o.divisi.add("hr");

  // ── Pengingat baca Pedoman: aktif ≥ 27 jam kerja sejak terbit ──
  const belumBaca = berlaku && berlaku.diterbitkan_pada && tambahJamKerja(new Date(berlaku.diterbitkan_pada), JAM_PENGINGAT_BACA, peta).getTime() < sekarang.getTime()
    && terbuka   // gerbang tertutup → karyawan tidak melihat Pedoman, jadi tidak ada pengingat soal staf
    ? [...orang.values()].filter((o) => !o.owner && !sudahBaca.has(o.uid))
    : [];

  // ── Cuti/izin/sakit Disetujui (membebaskan leader dari Ringkasan Harian hari ini) ──
  const cuti = new Set((apr || []).filter((r: any) => jenisBebasRingkasan(r.jenis) && tanggalPengajuan(r.tanggal).includes(hari)).map((r: any) => String(r.idKaryawan)));

  const dataUmum = { usulan, dampak: dampak || [], tautanPedoman: (tautan || []).map((t: any) => String(t.usulan_id)), peta };
  const penerima: { uid: string; kunci: string[]; judul: string[] }[] = [];
  let dikirim = 0, terkirim = 0;
  for (const o of orang.values()) {
    if (!o.peran.size) continue;
    if (!terbuka && !emailStudio(o.emailAkun)) continue;   // gerbang tertutup: anggota non-studio tidak berperan
    const peran = [...o.peran], divisi = [...o.divisi];
    const divL = divisi.find((d) => DIVISI_LEADER.includes(d));
    const item: ItemTindakan[] = hitungPerluTindakan({
      ...dataUmum,
      pedomanBelumDibaca: !!berlaku && !sudahBaca.has(o.uid),
      serahTerima: st || undefined,
      ringkasanHariIni: rh || undefined,
      sudahKirimRingkasan: rh ? rh.some((r: any) => r.user_id === o.uid) : undefined,
      hariIniDihitung: rh && divL ? !(o.idk && cuti.has(o.idk)) : undefined,
    }, peran, divisi, sekarang);
    if (berlaku) {
      for (const d of divisi.filter((x) => DIVISI_LEADER.includes(x))) {
        const n = belumBaca.filter((s) => s.divisiStaf === d && s.uid !== o.uid).length;
        if (n) item.push({ kunci: `baca-staf:${d}`, judul: `${n} staf ${DIVISI_LABEL[d]} belum konfirmasi Pedoman ${berlaku.versi}`, tautan: "?tab=pedoman&sub=status", mendesak: false });
      }
      if (o.peran.has("hr")) {
        const n = belumBaca.filter((s) => !s.divisiStaf && s.uid !== o.uid).length;
        if (n) item.push({ kunci: "baca-staf:tanpa-divisi", judul: `${n} karyawan tanpa divisi belum konfirmasi Pedoman ${berlaku.versi}`, tautan: "?tab=pedoman&sub=status", mendesak: false });
      }
    }
    if (!item.length) continue;
    const base = o.emailAkun.endsWith("@invisual.studio") ? "/admin" : "/user";
    const r = await kirim([o.uid], {
      title: `Management — ${item.length} hal perlu tindakan`,
      body: item.slice(0, 2).map((x) => x.judul).join(" · "),
      url: `${base}/management?tab=ringkasan`,
      tag: "mgmt-pagi",
    });
    dikirim++; terkirim += r?.sent || 0;
    penerima.push({ uid: o.uid, kunci: item.map((x) => x.kunci), judul: item.map((x) => x.judul) });
  }
  return { ok: true, dikirim, terkirim, penerima };
}
