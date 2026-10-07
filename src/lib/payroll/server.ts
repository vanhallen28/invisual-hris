// src/lib/payroll/server.ts
// Logika server payroll — dipanggil rute /api/payroll/* (HANYA server).
// Menerima klien Supabase sebagai parameter supaya bisa diuji dengan tiruan.
//
// Aturan:
//   - Pemanggil wajib HR (@invisual.studio) → verifikasiHR().
//   - Operasi memakai service role (klienService) agar tidak tergantung RLS,
//     tetapi KUNCI periode final tetap ditegakkan trigger DB (payroll.sql).
//   - Pengiriman email diproses ≤ BATAS_KIRIM slip per panggilan (batas waktu
//     fungsi Vercel Hobby); klien memanggil berulang sampai `sisa` = 0.
//   - Dua HR tidak bisa mengirim periode yang sama bersamaan: kunci
//     `payroll_periode.kirim_mulai` (kedaluwarsa KUNCI_KIRIM_MS).
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { excludeOwners } from "@/lib/owners";
import { fleksibelIds } from "@/lib/keterlambatan";
import { isoValid } from "@/lib/rentangTanggal";
import { angkaAman, emailKaryawan, gajiPokokMaster, karyawanAktif, keSlipTampil, labelPeriode, namaBerkasSlip, potretKehadiran, formatRupiah, type SlipBaris } from "./hitung";
import { buatSlipPdf } from "./slipPdf";
import { PERUSAHAAN } from "./perusahaan";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** Maksimal slip yang dikirim per panggilan /api/payroll/kirim. */
export const BATAS_KIRIM = 5;
/** Jeda antar kiriman ke Resend (batas laju ±2 permintaan/detik). */
export const JEDA_KIRIM_MS = 600;
/** Kunci kirim per periode dianggap basi setelah ini (satu batch jauh lebih singkat). */
export const KUNCI_KIRIM_MS = 120_000;

type Gagal = { ok: false; status: number; pesan: string };
const gagal = (status: number, pesan: string): Gagal => ({ ok: false, status, pesan });
/** UUID v1–v5 (id tabel payroll). */
export const uuidValid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const tidur = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

/** Token Bearer → pengguna Supabase; hanya email @invisual.studio yang lolos. */
export async function verifikasiHR(req: Request): Promise<{ email: string } | null> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !URL_SB || !ANON) return null;
  try {
    const asUser = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data, error } = await asUser.auth.getUser(token);
    const email = String(data?.user?.email || "").trim().toLowerCase();
    if (error || !email.endsWith("@invisual.studio")) return null;
    return { email };
  } catch {
    return null;
  }
}

/** Klien service role (null bila env belum diset). */
export function klienService(): any {
  const key = process.env.SUPABASE_SERVICE_ROLE || "";
  if (!URL_SB || !key) return null;
  return createClient(URL_SB, key, { auth: { persistSession: false } });
}

/** Catat ke audit_log; kegagalan audit tidak boleh menggagalkan aksi. */
export async function catatAudit(sb: any, actor: string, action: string, target?: string, detail?: string) {
  try {
    await sb.from("audit_log").insert([{ actor, action, target: target || null, detail: detail || null }]);
  } catch { /* abaikan */ }
}

/** Ambil SEMUA baris berpaginasi (PostgREST membatasi 1000 baris/respons) — pola sama dengan halaman Kehadiran. */
export async function ambilSemuaBaris(bangun: () => any): Promise<any[]> {
  const semua: any[] = [];
  const uk = 1000;
  for (let dari = 0, put = 0; put < 100; put++, dari += uk) {
    const { data, error } = await bangun().order("id", { ascending: true }).range(dari, dari + uk - 1);
    if (error) throw error;
    const b = data || [];
    semua.push(...b);
    if (b.length < uk) break;
  }
  return semua;
}

async function ambilPeriode(sb: any, id: string) {
  if (!id) return null;
  const { data, error } = await sb.from("payroll_periode").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Karyawan aktif (bukan owner, isAktif ≠ false, punya idKaryawan), unik per idKaryawan. */
async function karyawanAktifSemua(sb: any) {
  const { data, error } = await sb.from("employees").select("*");
  if (error) throw error;
  const unik = new Map<string, any>();
  excludeOwners((data || []) as any[]).filter(karyawanAktif).forEach((e: any) => {
    const id = String(e.idKaryawan ?? "").trim();
    if (id && !unik.has(id)) unik.set(id, e);
  });
  return Array.from(unik.values());
}

/** Potret identitas karyawan yang dibekukan di slip (bisa disegarkan selama draf). */
const identitasDari = (e: any) => ({
  nama: String(e.nama || "-"),
  jabatan: e.jabatan || null,
  nama_bank: e.namaBank || null,
  no_rekening: e.noRekening || null,
  email: emailKaryawan(e) || null,
});

const barisSlipDari = (e: any, periodeId: string, salinLama: boolean) => ({
  periode_id: periodeId,
  idKaryawan: String(e.idKaryawan).trim(),
  ...identitasDari(e),
  gaji_pokok: gajiPokokMaster(e),
  bonus: salinLama ? angkaAman(e.bonus) : 0,
  potongan: salinLama ? angkaAman(e.potongan) : 0,
});

/** Segarkan nama/jabatan/bank/rekening/email slip draf dari employees. Mengembalikan jumlah slip yang berubah. */
async function segarkanIdentitas(sb: any, periodeId: string, slips: any[], karyawan: any[], oleh?: string) {
  const peta = new Map(karyawan.map((e: any) => [String(e.idKaryawan).trim(), e]));
  let n = 0;
  for (const s of slips) {
    const e = peta.get(String(s.idKaryawan));
    if (!e) continue;
    const baru = identitasDari(e);
    const beda = (Object.keys(baru) as (keyof typeof baru)[]).some((k) => (baru[k] ?? null) !== (s[k] ?? null));
    if (!beda) continue;
    const { error } = await sb.from("payroll_slip").update({ ...baru, ...(oleh ? { diubah_oleh: oleh } : {}) }).eq("id", s.id).eq("periode_id", periodeId);
    if (error) throw error;
    n++;
  }
  return n;
}

/**
 * Buat periode baru + satu slip per karyawan aktif. Idempoten: rentang yang
 * sudah ada mengembalikan id-nya tanpa menambah slip. Pada PERIODE PERTAMA
 * (tabel masih kosong) bonus/potongan lama dari employees ikut disalin.
 */
export async function buatPeriode(sb: any, p: { dari: string; sampai: string }, hrEmail: string) {
  if (!isoValid(p?.dari) || !isoValid(p?.sampai) || p.sampai <= p.dari) return gagal(400, "Rentang periode tidak valid.");
  const cariAda = async () => {
    const { data, error } = await sb.from("payroll_periode").select("id").eq("dari", p.dari).eq("sampai", p.sampai).maybeSingle();
    if (error) throw error;
    return data?.id ? String(data.id) : null;
  };
  const ada = await cariAda();
  if (ada) return { ok: true as const, id: ada, jumlah: 0, sudahAda: true };

  const { data: semua, error: e1 } = await sb.from("payroll_periode").select("id").limit(1);
  if (e1) throw e1;
  const periodePertama = !(semua || []).length;
  const label = labelPeriode(p);

  const { data: baru, error: e2 } = await sb.from("payroll_periode").insert([{ label, dari: p.dari, sampai: p.sampai, status: "draf", dibuat_oleh: hrEmail }]).select("id").single();
  if (e2) {
    // Dua HR membuat periode yang sama bersamaan → unik (dari,sampai) → anggap sudah ada.
    if (String(e2.code) === "23505") { const id = await cariAda(); if (id) return { ok: true as const, id, jumlah: 0, sudahAda: true }; }
    throw e2;
  }
  const periodeId = String(baru.id);
  const karyawan = await karyawanAktifSemua(sb);
  const rows = karyawan.map((e: any) => barisSlipDari(e, periodeId, periodePertama));
  if (rows.length) {
    const { error: e3 } = await sb.from("payroll_slip").insert(rows);
    if (e3) {
      // Kompensasi: jangan tinggalkan periode kosong yang tidak bisa diisi.
      await sb.from("payroll_slip").delete().eq("periode_id", periodeId);
      await sb.from("payroll_periode").delete().eq("id", periodeId);
      throw e3;
    }
  }
  await catatAudit(sb, hrEmail, "payroll_buat", label, `${rows.length} slip${periodePertama ? " (bonus/potongan lama disalin)" : ""}`);
  return { ok: true as const, id: periodeId, jumlah: rows.length, sudahAda: false };
}

/**
 * Sinkronkan periode draf dengan data karyawan: tambah slip untuk karyawan aktif
 * yang belum punya slip, dan segarkan identitas (nama/jabatan/bank/rekening/email)
 * slip yang sudah ada. Angka gaji tidak disentuh.
 */
export async function sinkronPeriode(sb: any, periodeId: string, hrEmail?: string) {
  const per = await ambilPeriode(sb, periodeId);
  if (!per) return gagal(404, "Periode tidak ditemukan.");
  if (per.status !== "draf") return gagal(409, "Periode sudah final.");
  const { data: slips, error } = await sb.from("payroll_slip").select("id, idKaryawan, nama, jabatan, nama_bank, no_rekening, email").eq("periode_id", periodeId);
  if (error) throw error;
  const karyawan = await karyawanAktifSemua(sb);
  const sudah = new Set((slips || []).map((s: any) => String(s.idKaryawan)));
  const rows = karyawan.filter((e: any) => !sudah.has(String(e.idKaryawan).trim())).map((e: any) => barisSlipDari(e, periodeId, false));
  if (rows.length) {
    const { error: e2 } = await sb.from("payroll_slip").insert(rows);
    if (e2) throw e2;
  }
  const diperbarui = await segarkanIdentitas(sb, periodeId, slips || [], karyawan, hrEmail);
  return { ok: true as const, ditambahkan: rows.length, diperbarui };
}

/**
 * Finalkan: identitas slip disegarkan, potret kehadiran (hadir/telat) disimpan
 * ke tiap slip, status → final. Mengembalikan userIds (employees.user_id)
 * untuk notifikasi push dari klien.
 */
export async function finalkanPeriode(sb: any, periodeId: string, hrEmail: string) {
  const per = await ambilPeriode(sb, periodeId);
  if (!per) return gagal(404, "Periode tidak ditemukan.");
  if (per.status !== "draf") return gagal(409, "Periode sudah final.");
  const { data: slips, error: e1 } = await sb.from("payroll_slip").select("*").eq("periode_id", periodeId);
  if (e1) throw e1;
  const { data: emps, error: e2 } = await sb.from("employees").select("*");
  if (e2) throw e2;
  await segarkanIdentitas(sb, periodeId, slips || [], emps || [], hrEmail);
  const ids: string[] = (slips || []).map((s: any) => String(s.idKaryawan));
  const rentang = { dari: String(per.dari).slice(0, 10), sampai: String(per.sampai).slice(0, 10) };
  let att: any[] = [];
  if (ids.length) {
    // Filter tanggal sama persis dengan halaman Kehadiran (gte/lte "YYYY-MM-DD"), berpaginasi.
    att = await ambilSemuaBaris(() => sb.from("attendance").select("*").gte("tanggal", rentang.dari).lte("tanggal", rentang.sampai).in("idKaryawan", ids));
  }
  const fleks = fleksibelIds(emps || []);
  for (const s of slips || []) {
    const potret = potretKehadiran(att, String(s.idKaryawan), fleks, rentang);
    const { error } = await sb.from("payroll_slip").update({ hadir: potret.hadir, telat: potret.telat, diubah_oleh: hrEmail }).eq("id", s.id);
    if (error) throw error;
  }
  const { error: e4 } = await sb.from("payroll_periode").update({ status: "final", difinalkan_pada: new Date().toISOString(), difinalkan_oleh: hrEmail }).eq("id", periodeId);
  if (e4) throw e4;
  const petaUser = new Map<string, any>((emps || []).map((e: any) => [String(e.idKaryawan), e.user_id]));
  const userIds = Array.from(new Set(ids.map((id) => petaUser.get(id)).filter((u: any): u is string => !!u).map(String)));
  await catatAudit(sb, hrEmail, "payroll_final", String(per.label), `${ids.length} slip`);
  return { ok: true as const, jumlah: ids.length, userIds, label: String(per.label) };
}

/** Buka kunci: status final → draf (angka bisa diubah lagi; slip disembunyikan dari karyawan). */
export async function bukaKunciPeriode(sb: any, periodeId: string, hrEmail: string) {
  const per = await ambilPeriode(sb, periodeId);
  if (!per) return gagal(404, "Periode tidak ditemukan.");
  if (per.status !== "final") return gagal(409, "Periode belum final.");
  const { data: slips, error } = await sb.from("payroll_slip").select("email_status").eq("periode_id", periodeId);
  if (error) throw error;
  const sudahTerkirim = (slips || []).filter((s: any) => s.email_status === "terkirim").length;
  const { error: e2 } = await sb.from("payroll_periode").update({ status: "draf" }).eq("id", periodeId);
  if (e2) throw e2;
  await catatAudit(sb, hrEmail, "payroll_buka", String(per.label), `${sudahTerkirim} slip sudah terkirim sebelumnya`);
  return { ok: true as const, sudahTerkirim };
}

const b64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64");
const escapeHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type HasilKirim = { ok: boolean; pesan?: string; batasLaju?: boolean };

async function kirimResend(apiKey: string, payload: any): Promise<HasilKirim> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true };
  const j: any = await res.json().catch(() => ({}));
  return { ok: false, batasLaju: res.status === 429, pesan: String(j?.message || j?.error?.message || `HTTP ${res.status}`) };
}

/** Klaim kunci kirim periode (atomik lewat kondisi di UPDATE). true = dapat. */
async function klaimKunciKirim(sb: any, periodeId: string) {
  const kini = Date.now();
  const basi = new Date(kini - KUNCI_KIRIM_MS).toISOString();
  const { data, error } = await sb.from("payroll_periode").update({ kirim_mulai: new Date(kini).toISOString() })
    .eq("id", periodeId).or(`kirim_mulai.is.null,kirim_mulai.lt.${basi}`).select("id");
  if (error) throw error;
  return (data || []).length > 0;
}
async function lepasKunciKirim(sb: any, periodeId: string) {
  try { await sb.from("payroll_periode").update({ kirim_mulai: null }).eq("id", periodeId); } catch { /* kedaluwarsa sendiri */ }
}

/**
 * Kirim slip (PDF terlampir) via Resend, maksimal BATAS_KIRIM per panggilan.
 * Tanpa `idKaryawan`: target = slip berstatus `belum` saja — setiap slip yang
 *   diproses keluar dari `belum`, jadi `sisa` pasti berkurang dan putaran
 *   klien pasti berhenti (slip gagal permanen, mis. tanpa email, tidak
 *   diulang terus-menerus).
 * Dengan `idKaryawan`: kirim (ulang) slip tersebut apa pun statusnya; klien
 *   memecah daftar panjang menjadi ≤ BATAS_KIRIM per panggilan.
 * Tanpa apiKey → status `simulasi`.
 * Resend 429 (batas laju): slip TIDAK ditandai gagal (tetap `belum`), batch
 *   dihentikan, respons memuat `batasLaju: true` agar klien menunggu lalu mengulang.
 */
export async function kirimSlipBatch(sb: any, p: {
  periodeId: string;
  idKaryawan?: string[];
  hrEmail: string;
  apiKey: string;
  from: string;
  kirim?: (payload: any) => Promise<HasilKirim>;
  jedaMs?: number;
}) {
  const per = await ambilPeriode(sb, p.periodeId);
  if (!per) return gagal(404, "Periode tidak ditemukan.");
  if (per.status !== "final") return gagal(409, "Finalkan periode dulu sebelum mengirim slip.");
  if (!(await klaimKunciKirim(sb, p.periodeId))) return gagal(409, "Pengiriman periode ini sedang berjalan (mungkin oleh HR lain). Coba lagi sebentar.");
  const label = String(per.label);
  const khusus = Array.isArray(p.idKaryawan) && p.idKaryawan.length > 0;
  const jeda = p.jedaMs ?? JEDA_KIRIM_MS;
  let terkirim = 0, gagalN = 0, simulasi = 0, diproses = 0, batasLaju = false;
  let daftar: SlipBaris[] = [];
  try {
    let q = sb.from("payroll_slip").select("*").eq("periode_id", p.periodeId);
    q = khusus ? q.in("idKaryawan", p.idKaryawan!.map(String)) : q.eq("email_status", "belum");
    const { data: target, error } = await q.order("nama", { ascending: true });
    if (error) throw error;
    daftar = (target || []) as any;
    const batch = daftar.slice(0, BATAS_KIRIM);
    const kirim = p.kirim || ((payload: any) => kirimResend(p.apiKey, payload));

    for (let i = 0; i < batch.length; i++) {
      const s = batch[i];
      const email = String(s.email || "").trim().toLowerCase();
      let status: "terkirim" | "gagal" | "simulasi" = "gagal";
      let galat: string | null = null;
      if (!email) {
        galat = "Karyawan tidak punya email";
      } else if (!p.apiKey) {
        status = "simulasi";
        console.log(`[payroll] SIMULASI kirim slip ${label} → ${email}`);
      } else {
        try {
          const tampil = keSlipTampil(s);
          const pdf = buatSlipPdf(tampil, label);
          const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#111">` +
            `<p>Halo ${escapeHtml(s.nama)},</p>` +
            `<p>Slip gaji Anda untuk periode <b>${escapeHtml(label)}</b> terlampir (PDF).</p>` +
            `<p>Take Home Pay: <b>${escapeHtml(formatRupiah(tampil.gajiBersih))}</b></p>` +
            `<p>Slip ini juga bisa dibuka di HRIS &rsaquo; Profil.</p>` +
            `<p style="color:#666">${escapeHtml(PERUSAHAAN.nama)} · ${escapeHtml(PERUSAHAAN.departemen)}</p></div>`;
          const payload = {
            from: p.from,
            to: [email],
            subject: `Slip Gaji ${label} — ${s.nama}`,
            html,
            attachments: [{ filename: namaBerkasSlip(label, s.nama), content: b64(pdf) }],
          };
          if (i > 0) await tidur(jeda);
          let r = await kirim(payload);
          if (!r.ok && r.batasLaju) { await tidur(Math.max(jeda, 1000)); r = await kirim(payload); }
          if (r.ok) status = "terkirim";
          else if (r.batasLaju) { batasLaju = true; break; }   // biarkan `belum`, coba lagi di putaran berikutnya
          else galat = r.pesan || "Gagal mengirim";
        } catch (e: any) {
          galat = String(e?.message || e);
        }
      }
      const { error: eU } = await sb.from("payroll_slip").update({
        email_status: status,
        email_dikirim_pada: status === "terkirim" || status === "simulasi" ? new Date().toISOString() : null,
        email_galat: galat,
      }).eq("id", s.id);
      if (eU) throw eU;
      diproses++;
      if (status === "terkirim") terkirim++; else if (status === "simulasi") simulasi++; else gagalN++;
    }
  } finally {
    await lepasKunciKirim(sb, p.periodeId);
  }

  const sisa = Math.max(0, daftar.length - diproses);
  if (!khusus && sisa === 0 && (terkirim > 0 || simulasi > 0)) {
    await sb.from("payroll_periode").update({ dikirim_pada: new Date().toISOString() }).eq("id", p.periodeId);
  }
  await catatAudit(sb, p.hrEmail, "payroll_kirim", label, `diproses ${diproses}: terkirim ${terkirim}, gagal ${gagalN}, simulasi ${simulasi}, sisa ${sisa}${batasLaju ? " (batas laju Resend)" : ""}`);
  return { ok: true as const, diproses, terkirim, gagal: gagalN, simulasi, sisa, label, batasLaju };
}
