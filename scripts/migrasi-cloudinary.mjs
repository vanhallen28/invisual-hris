#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MIGRASI MEDIA LAMA → CLOUDINARY (sekali jalan, dijalankan dari komputer Anda)
//
//   node scripts/migrasi-cloudinary.mjs                 → UJI (hanya menghitung, tidak mengubah apa pun)
//   node scripts/migrasi-cloudinary.mjs --jalankan      → benar-benar memindahkan
//
// Opsi:
//   --hanya=avatar,stiker,chat,tugas,dokumen,setoran,pesan,absen   → hanya bagian tertentu
//   --batas=20        → paling banyak 20 berkas per bagian (untuk coba-coba dulu)
//   --min-kb=150      → lampiran privat di bawah ukuran ini dilewati (sudah kecil)
//   --hapus-lama      → (bersama --jalankan) hapus berkas LAMA di Supabase setelah semua
//                       rujukannya terbukti sudah berganti ke Cloudinary. Sebaiknya
//                       dijalankan terpisah, setelah Anda mengecek aplikasi.
//
// Yang dikerjakan:
//   PUBLIK  (avatar karyawan, stiker, lampiran chat, lampiran chat Daily Task, gambar di
//            dokumen Daily Task, Setoran Daily) → disalin ke Cloudinary dengan kompresi
//            yang sama seperti unggahan baru, lalu URL di database diganti ke URL Cloudinary.
//   PRIVAT  (lampiran Pesan Pribadi, selfie absen ≤ 7 hari) → dikompres lewat Cloudinary lalu
//            DITIMPA di tempat yang sama di Supabase (path & aturan akses tidak berubah).
//            Salinan di Cloudinary langsung dihapus.
//
// Aman diulang: kemajuan dicatat di .migrasi-cloudinary/jurnal.json (JANGAN di-commit — berisi
// nama berkas lampiran), berkas yang sudah selesai dilewati. Berkas lama di Supabase TIDAK
// dihapus kecuali dengan --hapus-lama.
//
// Sebaiknya dijalankan saat aplikasi sepi (mis. malam hari): baris dibaca ulang tepat sebelum
// ditulis, tetapi perubahan yang terjadi pada detik yang sama tetap bisa tertimpa.
//
// Setelah memigrasi Pesan Pribadi, jalankan migrasi-cloudinary-pemilik.sql sekali di Supabase
// (memulihkan "pemilik" berkas lampiran yang ditimpa, agar pengirim tetap bisa menghapusnya).
//
// Kebutuhan env (dibaca dari .env.local / .env di folder proyek, atau dari shell):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE (atau SUPABASE_SERVICE_ROLE_KEY),
//   CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (atau CLOUDINARY_URL),
//   CLOUDINARY_FOLDER (opsional).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";

/* ───────────── argumen & env ───────────── */
const ARG = process.argv.slice(2);
const JALANKAN = ARG.includes("--jalankan");
const HAPUS_LAMA = ARG.includes("--hapus-lama");
const ambilArg = (nama) => (ARG.find((a) => a.startsWith(`--${nama}=`)) || "").split("=").slice(1).join("=");
const HANYA = ambilArg("hanya").split(",").map((s) => s.trim()).filter(Boolean);
const BATAS_ITEM = Number(ambilArg("batas")) || Infinity;
const MIN_KB = Number(ambilArg("min-kb")) || 150;
const ikut = (bagian) => !HANYA.length || HANYA.includes(bagian);

function muatEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const baris of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(baris);
      if (!m || baris.trim().startsWith("#")) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      else v = v.replace(/\s+#.*$/, "");
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}
muatEnv();

const SUPA = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
function konfigCloudinary() {
  let cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  let apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  let apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@([^/?#\s]+)/.exec(String(process.env.CLOUDINARY_URL || "").trim());
  if (m) { apiKey ||= decodeURIComponent(m[1]); apiSecret ||= decodeURIComponent(m[2]); cloudName ||= m[3]; }
  const folder = String(process.env.CLOUDINARY_FOLDER || "invisual-hris").trim().replace(/[^A-Za-z0-9_/-]/g, "_").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "") || "invisual-hris";
  return { cloudName, apiKey, apiSecret, folder };
}
const CLD = konfigCloudinary();

const kurang = [];
if (!SUPA) kurang.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE) kurang.push("SUPABASE_SERVICE_ROLE");
if (!CLD.cloudName || !CLD.apiKey || !CLD.apiSecret) kurang.push("CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET (atau CLOUDINARY_URL)");
if (kurang.length) {
  console.error("✗ Env belum lengkap:\n  - " + kurang.join("\n  - ") + "\nIsi di .env.local lalu jalankan lagi.");
  process.exit(1);
}

/* ───────────── aturan kompresi (sama dengan src/lib/cloudinary/aturan.ts) ───────────── */
const BATAS = { gambarMaksByte: 10 * 1024 * 1024, videoMaksByte: 40 * 1024 * 1024, gambarPx: 1600, gambarKecilPx: 512, videoPx: 1280 };
const EKS_GAMBAR = ["jpg", "jpeg", "jfif", "png", "gif", "webp", "heic", "heif", "avif", "bmp"];
const EKS_VIDEO = ["mp4", "m4v", "mov", "qt", "webm", "3gp", "3g2", "mkv", "avi", "mpeg", "mpg", "ogv", "wmv"];
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif", bmp: "image/bmp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const ekstensi = (s) => { const m = /\.([a-z0-9]+)$/i.exec(String(s || "").split("?")[0]); return m ? m[1].toLowerCase() : ""; };
function jenisMedia(tipe, nama) {
  const t = String(tipe || "").toLowerCase();
  const e = ekstensi(nama);
  if (t === "image/svg+xml" || e === "svg") return null;
  if (t.startsWith("image/")) return /^image\/(jpe?g|pjpeg|png|gif|webp|heic|heif|avif|bmp)$/.test(t) || EKS_GAMBAR.includes(e) ? "image" : null;
  if (t.startsWith("video/")) return "video";
  if (EKS_GAMBAR.includes(e)) return "image";
  if (EKS_VIDEO.includes(e)) return "video";
  return null;
}
const HANYA_GAMBAR = ["avatar", "stiker", "absen"];
const transformasi = (tujuan, jenis) => jenis === "video"
  ? `c_limit,w_${BATAS.videoPx},h_${BATAS.videoPx}/q_auto`
  : `c_limit,w_${["avatar", "stiker"].includes(tujuan) ? BATAS.gambarKecilPx : BATAS.gambarPx},h_${["avatar", "stiker"].includes(tujuan) ? BATAS.gambarKecilPx : BATAS.gambarPx}/q_auto`;
const formatKeluaran = (jenis, tipe, nama) => {
  if (jenis === "video") return "mp4";
  const t = String(tipe || "").toLowerCase(); const e = ekstensi(nama);
  return t === "image/heic" || t === "image/heif" || e === "heic" || e === "heif" ? "jpg" : undefined;
};
const namaAman = (s) => String(s || "").replace(/\.[a-z0-9]+$/i, "").normalize("NFKD").replace(/[^\w-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "berkas";
const namaDenganFormat = (nama, format) => {
  const f = String(format || "").toLowerCase(); const lama = ekstensi(nama);
  if (!f || lama === f || (lama === "jpeg" && f === "jpg")) return nama;
  return `${String(nama || "berkas").replace(/\.[a-z0-9]+$/i, "")}.${f}`;
};
const bolehUkuran = (jenis, byte) => byte > 0 && (jenis === "image" ? byte <= BATAS.gambarMaksByte : byte <= BATAS.videoMaksByte);

/* ───────────── jurnal ───────────── */
const JURNAL = resolve(process.cwd(), ".migrasi-cloudinary/jurnal.json");
let jurnal = { publik: {}, privat: {} };
try { if (existsSync(JURNAL)) jurnal = { publik: {}, privat: {}, ...JSON.parse(readFileSync(JURNAL, "utf8")) }; } catch { /* mulai baru */ }
const simpanJurnal = () => { if (!JALANKAN) return; mkdirSync(dirname(JURNAL), { recursive: true }); writeFileSync(JURNAL, JSON.stringify(jurnal, null, 1)); };

/* ───────────── Supabase (service role) ───────────── */
const hSB = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
async function sb(method, jalur, body, tambahan = {}) {
  const res = await fetch(`${SUPA}/rest/v1/${jalur}`, {
    method,
    headers: { ...hSB, "Content-Type": "application/json", Prefer: "return=minimal", ...tambahan },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const teks = await res.text();
  if (!res.ok) throw new Error(`${method} ${jalur.split("?")[0]} → ${res.status} ${teks.slice(0, 200)}`);
  return teks ? JSON.parse(teks) : null;
}
/** Semua baris (per 1000). null bila tabel/kolom tidak ada atau gagal dibaca. */
let PINDAI_GAGAL = 0;
async function ambilSemua(tabel, select, urut, filter = "") {
  const hasil = [];
  try {
    for (let off = 0; off < 2_000_000; off += 1000) {
      const rows = await sb("GET", `${tabel}?select=${select}&order=${urut}&limit=1000&offset=${off}${filter ? "&" + filter : ""}`);
      hasil.push(...(rows || []));
      if (!rows || rows.length < 1000) break;
    }
    return hasil;
  } catch (e) {
    console.warn(`  ! ${tabel} dilewati: ${e.message}`);
    PINDAI_GAGAL++;
    return null;
  }
}
const encPath = (p) => String(p).split("/").map(encodeURIComponent).join("/");
async function unduhStorage(bucket, path) {
  const res = await fetch(`${SUPA}/storage/v1/object/${bucket}/${encPath(path)}`, { headers: hSB });
  if (!res.ok) throw new Error(`unduh ${bucket}/${path} → ${res.status}`);
  return { buf: Buffer.from(await res.arrayBuffer()), tipe: res.headers.get("content-type") || "" };
}
async function timpaStorage(bucket, path, buf, tipe) {
  const res = await fetch(`${SUPA}/storage/v1/object/${bucket}/${encPath(path)}`, {
    method: "POST", headers: { ...hSB, "Content-Type": tipe, "x-upsert": "true", "cache-control": "max-age=3600" }, body: buf,
  });
  if (!res.ok) throw new Error(`timpa ${bucket}/${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
}
async function hapusStorage(bucket, paths) {
  for (let i = 0; i < paths.length; i += 100) {
    const res = await fetch(`${SUPA}/storage/v1/object/${bucket}`, {
      method: "DELETE", headers: { ...hSB, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }),
    });
    if (!res.ok) console.warn(`  ! gagal hapus ${bucket}: ${res.status}`);
  }
}

/** Ambil SATU baris terbaru tepat sebelum ditulis (mengurangi risiko menimpa suntingan pengguna). */
async function ambilSatu(tabel, select, filter) {
  const rows = await sb("GET", `${tabel}?select=${select}&${filter}&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}
const eq = (v) => `eq.${encodeURIComponent(String(v))}`;

/* ───────────── Cloudinary ───────────── */
// CLOUDINARY_API_BASE hanya untuk pengujian (server tiruan); biarkan kosong.
const API = `${String(process.env.CLOUDINARY_API_BASE || "https://api.cloudinary.com/v1_1").replace(/\/+$/, "")}/${CLD.cloudName}`;
const tandaTangan = (params) => createHash("sha1").update(
  Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "").sort().map((k) => `${k}=${params[k]}`).join("&") + CLD.apiSecret,
).digest("hex");

async function unggahCloudinary(jenis, sumber, params) {
  const p = { ...params, timestamp: Math.floor(Date.now() / 1000) };
  Object.keys(p).forEach((k) => (p[k] === undefined) && delete p[k]);
  const fd = new FormData();
  if (typeof sumber === "string") fd.append("file", sumber);
  else fd.append("file", new Blob([sumber.buf], { type: sumber.tipe || "application/octet-stream" }), sumber.nama || "berkas");
  Object.entries(p).forEach(([k, v]) => fd.append(k, String(v)));
  fd.append("api_key", CLD.apiKey);
  fd.append("signature", tandaTangan(p));
  const res = await fetch(`${API}/${jenis}/upload`, { method: "POST", body: fd });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.secure_url) throw new Error(`Cloudinary: ${j?.error?.message || res.status}`);
  return j;
}
async function hapusCloudinary(jenis, type, publicId) {
  const p = { invalidate: "true", public_id: publicId, timestamp: Math.floor(Date.now() / 1000), type };
  const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])), api_key: CLD.apiKey, signature: tandaTangan(p) });
  await fetch(`${API}/${jenis}/destroy`, { method: "POST", body }).catch(() => null);
}
async function ukuranUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return { ok: false, byte: 0, status: res.status };
    return { ok: true, byte: Number(res.headers.get("content-length") || 0), tipe: res.headers.get("content-type") || "" };
  } catch { return { ok: false, byte: 0 }; }
}
const penanda = (jenis, type, publicId) => `cloudinary:${jenis}:${type}:${publicId}`;

/* ───────────── kumpulkan rujukan publik ───────────── */
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const POLA_URL = new RegExp(`${escRe(SUPA)}/storage/v1/object/public/(doc-assets|setoran)/[^\\s"'<>)\\\\]+`, "g");
const urlDalam = (teks) => Array.from(new Set(String(teks || "").match(POLA_URL) || []));
const bucketPathDari = (url) => {
  const m = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(url.split("?")[0]);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
};
/** Ganti semua URL lama → baru di nilai apa pun (teks, larik, objek JSON). */
function gantiDalam(nilai, peta) {
  if (typeof nilai === "string") {
    let s = nilai;
    for (const u of urlDalam(nilai)) if (peta[u]) s = s.split(u).join(peta[u].url);
    return s;
  }
  if (Array.isArray(nilai)) return nilai.map((x) => gantiDalam(x, peta));
  if (nilai && typeof nilai === "object") return Object.fromEntries(Object.entries(nilai).map(([k, v]) => [k, gantiDalam(v, peta)]));
  return nilai;
}

async function kumpulkanPublik(semua = false) {
  const ik = (b) => semua || ikut(b);
  const kandidat = new Map(); // url → { tujuan, pemilik, tipe? }
  const tambah = (url, tujuan, pemilik = "migrasi", tipe = "") => {
    if (!url || kandidat.has(url)) return;
    const bp = bucketPathDari(url);
    const jenis = jenisMedia(tipe, bp?.path || url);
    if (!jenis || (jenis === "video" && HANYA_GAMBAR.includes(tujuan))) return;
    kandidat.set(url, { tujuan, pemilik, tipe, jenis });
  };
  const data = {};
  data.employees = ik("avatar") ? await ambilSemua("employees", "idKaryawan,avatarUrl", "idKaryawan.asc", "avatarUrl=not.is.null") : [];
  (data.employees || []).forEach((r) => urlDalam(r.avatarUrl).forEach((u) => tambah(u, "avatar")));
  data.chat_stickers = ik("stiker") ? await ambilSemua("chat_stickers", "id,url", "id.asc") : [];
  (data.chat_stickers || []).forEach((r) => urlDalam(r.url).forEach((u) => tambah(u, "stiker")));
  data.chat_messages = ik("chat") ? await ambilSemua("chat_messages", "id,attachments,content", "id.asc") : [];
  data.chat_messages = (data.chat_messages || []).filter((r) => urlDalam(JSON.stringify([r.attachments ?? null, r.content ?? null])).length);
  data.chat_messages.forEach((r) => {
    (Array.isArray(r.attachments) ? r.attachments : []).forEach((a) => urlDalam(a?.url).forEach((u) => tambah(u, a?.type === "sticker" ? "stiker" : "chat", "migrasi", a?.type === "sticker" ? "" : a?.type)));
    urlDalam(r.content).forEach((u) => tambah(u, "chat"));   // tautan yang ditempel di isi pesan
  });
  data.item_updates = ik("tugas") ? await ambilSemua("item_updates", "id,text", "id.asc", "text=like.*storage/v1/object/public*") : [];
  (data.item_updates || []).forEach((r) => urlDalam(r.text).forEach((u) => tambah(u, "tugas")));
  data.item_values = ik("dokumen") ? await ambilSemua("item_values", "item_id,column_id,value", "item_id.asc,column_id.asc") : [];
  data.item_values = (data.item_values || []).filter((r) => urlDalam(JSON.stringify(r.value ?? null)).length);
  data.item_values.forEach((r) => urlDalam(JSON.stringify(r.value)).forEach((u) => tambah(u, "dokumen")));
  // Dokumen Deskripsi/Brief tersimpan di items.description (bukan item_values)
  data.items = ik("dokumen") ? await ambilSemua("items", "id,description", "id.asc", "description=like.*storage/v1/object/public*") : [];
  (data.items || []).forEach((r) => urlDalam(r.description).forEach((u) => tambah(u, "dokumen")));
  data.setoran_posts = ik("setoran") ? await ambilSemua("setoran_posts", "id,user_id,image_url,storage_path", "id.asc", "image_url=not.is.null") : [];
  (data.setoran_posts || []).forEach((r) => urlDalam(r.image_url).forEach((u) => tambah(u, "setoran", r.user_id || "migrasi")));
  return { kandidat, data, lengkap: PINDAI_GAGAL === 0 };
}

/* ───────────── jalankan ───────────── */
async function berurutan(daftar, n, kerja) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, daftar.length) }, async () => { while (i < daftar.length) { const x = daftar[i++]; await kerja(x); } }));
}
const fmt = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

async function migrasiPublik() {
  console.log("\n▶ MEDIA PUBLIK (Supabase → Cloudinary)");
  const { kandidat, data } = await kumpulkanPublik();
  const perTujuan = {};
  for (const [, v] of kandidat) perTujuan[v.tujuan] = (perTujuan[v.tujuan] || 0) + 1;
  console.log(`  ditemukan ${kandidat.size} berkas media:`, perTujuan);

  const belum = [...kandidat.entries()].filter(([u]) => !jurnal.publik[u]);
  const hitung = {};
  const terpilih = belum.filter(([, v]) => { hitung[v.tujuan] = (hitung[v.tujuan] || 0) + 1; return hitung[v.tujuan] <= BATAS_ITEM; });
  console.log(`  sudah dimigrasi sebelumnya: ${kandidat.size - belum.length} · akan diproses: ${terpilih.length}`);

  let total = 0, lewat = 0, sukses = 0, gagal = 0, sebelum = 0, sesudah = 0;
  await berurutan(terpilih, 4, async ([url, v]) => {
    const info = await ukuranUrl(url);
    if (!info.ok) { lewat++; console.log(`  - lewati (tak bisa diakses ${info.status || ""}): ${url}`); return; }
    if (!bolehUkuran(v.jenis, info.byte)) { lewat++; console.log(`  - lewati (terlalu besar ${fmt(info.byte)}): ${url}`); return; }
    total += info.byte;
    if (!JALANKAN) return;
    try {
      const bp = bucketPathDari(url);
      const nama = (bp?.path || "berkas").split("/").pop();
      // Awalan ANGKA (dari hash URL lama → tetap sama bila diulang): tampilan lama membuang "^\d+-".
      const angka = BigInt("0x" + createHash("sha1").update(url).digest("hex").slice(0, 15)).toString().padStart(19, "0");
      const j = await unggahCloudinary(v.jenis, url, {
        public_id: `${CLD.folder}/${v.tujuan}/${v.pemilik}/${angka}-${namaAman(nama.replace(/^\d+-/, ""))}`,
        transformation: transformasi(v.tujuan, v.jenis),
        format: formatKeluaran(v.jenis, v.tipe || info.tipe, nama),
      });
      jurnal.publik[url] = { url: j.secure_url, jenis: j.resource_type, publicId: j.public_id, format: j.format, byte: j.bytes };
      simpanJurnal();
      sukses++; sebelum += info.byte; sesudah += Number(j.bytes) || 0;
      console.log(`  ✓ ${v.tujuan.padEnd(8)} ${fmt(info.byte)} → ${fmt(Number(j.bytes) || 0)}  ${nama}`);
    } catch (e) { gagal++; console.log(`  ✗ ${v.tujuan} ${url}: ${e.message}`); }
  });
  console.log(`  ringkas: ${JALANKAN ? `${sukses} dipindah, ${gagal} gagal` : `${terpilih.length - lewat} siap dipindah (${fmt(total)})`}, ${lewat} dilewati${JALANKAN && sukses ? ` · ${fmt(sebelum)} → ${fmt(sesudah)}` : ""}`);

  if (!JALANKAN) return;
  // Ganti rujukan di database ke URL Cloudinary. Tiap baris DIBACA ULANG tepat sebelum ditulis
  // (atau ditulis dengan syarat nilai lama masih sama) agar suntingan pengguna tidak tertimpa.
  const peta = jurnal.publik;
  let diubah = 0, galatTulis = 0;
  const tulis = async (fn) => { try { if (await fn() !== false) diubah++; } catch (e) { galatTulis++; console.log(`  ✗ tulis: ${e.message}`); } };
  const adaPeta = (nilai) => urlDalam(JSON.stringify(nilai ?? null)).some((u) => peta[u]);
  for (const r of data.employees || []) {
    const baru = gantiDalam(r.avatarUrl, peta);
    if (baru !== r.avatarUrl && r.idKaryawan) await tulis(() => sb("PATCH", `employees?idKaryawan=${eq(r.idKaryawan)}&avatarUrl=${eq(r.avatarUrl)}`, { avatarUrl: baru }));
  }
  for (const r of data.chat_stickers || []) {
    const baru = gantiDalam(r.url, peta);
    if (baru !== r.url) await tulis(() => sb("PATCH", `chat_stickers?id=${eq(r.id)}&url=${eq(r.url)}`, { url: baru }));
  }
  for (const r0 of data.chat_messages || []) {
    if (!adaPeta([r0.attachments, r0.content])) continue;
    await tulis(async () => {
      const r = await ambilSatu("chat_messages", "id,attachments,content", `id=${eq(r0.id)}`);
      if (!r) return false;
      const patch = {};
      if (Array.isArray(r.attachments) && adaPeta(r.attachments)) {
        patch.attachments = r.attachments.map((a) => {
          const u = urlDalam(a?.url)[0];
          const m = u && peta[u];
          if (!m) return a;
          const b = { ...a, url: gantiDalam(a.url, peta) };
          if (a.type !== "sticker" && m.format) { b.type = MIME[m.format] || a.type; if (a.name) b.name = namaDenganFormat(a.name, m.format); }
          return b;
        });
      }
      if (typeof r.content === "string" && adaPeta(r.content)) patch.content = gantiDalam(r.content, peta);
      if (!Object.keys(patch).length) return false;
      await sb("PATCH", `chat_messages?id=${eq(r.id)}`, patch);
    });
  }
  for (const r of data.item_updates || []) {
    const baru = gantiDalam(r.text, peta);
    if (baru !== r.text) await tulis(() => sb("PATCH", `item_updates?id=${eq(r.id)}&text=${eq(r.text)}`, { text: baru }));
  }
  for (const r0 of data.item_values || []) {
    if (!adaPeta(r0.value)) continue;
    await tulis(async () => {
      const f = `item_id=${eq(r0.item_id)}&column_id=${eq(r0.column_id)}`;
      const r = await ambilSatu("item_values", "item_id,column_id,value", f);
      if (!r || !adaPeta(r.value)) return false;
      await sb("PATCH", `item_values?${f}`, { value: gantiDalam(r.value, peta) });
    });
  }
  for (const r0 of data.items || []) {
    if (!adaPeta(r0.description)) continue;
    await tulis(async () => {
      const r = await ambilSatu("items", "id,description", `id=${eq(r0.id)}`);
      if (!r || !adaPeta(r.description)) return false;
      await sb("PATCH", `items?id=${eq(r.id)}`, { description: gantiDalam(r.description, peta) });
    });
  }
  for (const r of data.setoran_posts || []) {
    const u = urlDalam(r.image_url)[0];
    const m = u && peta[u];
    if (m) await tulis(() => sb("PATCH", `setoran_posts?id=${eq(r.id)}&image_url=${eq(r.image_url)}`, { image_url: m.url, storage_path: penanda(m.jenis, "upload", m.publicId) }));
  }
  console.log(`  rujukan database diganti: ${diubah} baris${galatTulis ? ` · ${galatTulis} gagal (jalankan ulang untuk mencoba lagi)` : ""}`);

  if (!HAPUS_LAMA) { console.log("  berkas lama di Supabase DIBIARKAN (tambahkan --hapus-lama untuk menghapusnya)."); return; }
  if (galatTulis) { console.log("  ⚠ ada rujukan yang gagal ditulis → penghapusan berkas lama DIBATALKAN. Jalankan ulang dulu."); return; }
  // Hanya hapus yang sudah TIDAK dirujuk lagi di mana pun yang dipindai.
  PINDAI_GAGAL = 0;
  const ulang = await kumpulkanPublik(true);   // pindai SEMUA sumber, apa pun --hanya
  if (!ulang.lengkap) { console.log("  ⚠ ada tabel yang gagal dipindai → penghapusan berkas lama DIBATALKAN (demi aman)."); return; }
  const masihDirujuk = new Set(ulang.kandidat.keys());
  const hapus = {};
  for (const u of Object.keys(peta)) {
    if (masihDirujuk.has(u)) continue;
    const bp = bucketPathDari(u);
    if (bp) (hapus[bp.bucket] ||= []).push(bp.path);
  }
  for (const [bucket, paths] of Object.entries(hapus)) { await hapusStorage(bucket, paths); console.log(`  🗑  ${paths.length} berkas lama dihapus dari bucket ${bucket}`); }
  if (masihDirujuk.size) console.log(`  ${masihDirujuk.size} berkas lama masih dirujuk → tidak dihapus.`);
}

async function kompresPrivat(label, bucket, daftar, setelah) {
  // daftar: [{ kunci, path, tipe, nama, tujuan }]
  const belum = daftar.filter((x) => !jurnal.privat[`${bucket}/${x.path}`]).slice(0, BATAS_ITEM === Infinity ? undefined : BATAS_ITEM);
  console.log(`  ${label}: ${daftar.length} media · sudah ${daftar.length - daftar.filter((x) => !jurnal.privat[`${bucket}/${x.path}`]).length} · diproses ${belum.length}`);
  let sukses = 0, lewat = 0, gagal = 0, sebelum = 0, sesudah = 0;
  await berurutan(belum, 3, async (x) => {
    try {
      const asli = await unduhStorage(bucket, x.path);
      const jenis = jenisMedia(x.tipe || asli.tipe, x.nama || x.path);
      if (!jenis || asli.buf.length < MIN_KB * 1024 || !bolehUkuran(jenis, asli.buf.length)) { lewat++; jurnal.privat[`${bucket}/${x.path}`] = { dilewati: true }; simpanJurnal(); return; }
      if (!JALANKAN) { sebelum += asli.buf.length; return; }
      const j = await unggahCloudinary(jenis, { buf: asli.buf, tipe: x.tipe || asli.tipe, nama: `media.${ekstensi(x.nama || x.path) || "bin"}` }, {
        public_id: `${CLD.folder}/sementara/migrasi/${Date.now()}-${randomBytes(10).toString("hex")}`,
        type: "authenticated",
        transformation: transformasi(x.tujuan, jenis),
        format: formatKeluaran(jenis, x.tipe || asli.tipe, x.nama || x.path),
      });
      try {
        const res = await fetch(j.secure_url);
        if (!res.ok) throw new Error(`ambil hasil → ${res.status}`);
        const hasil = Buffer.from(await res.arrayBuffer());
        const tipeBaru = MIME[String(j.format || "").toLowerCase()] || x.tipe || asli.tipe;
        if (hasil.length && hasil.length < asli.buf.length && (bucket !== "foto-absen" || tipeBaru === "image/jpeg")) {
          await timpaStorage(bucket, x.path, hasil, tipeBaru);
          if (setelah) await setelah(x, { ukuran: hasil.length, tipe: tipeBaru, format: j.format });
          sebelum += asli.buf.length; sesudah += hasil.length; sukses++;
          console.log(`  ✓ ${fmt(asli.buf.length)} → ${fmt(hasil.length)}  ${x.path}`);
        } else { lewat++; }
        jurnal.privat[`${bucket}/${x.path}`] = { selesai: true };
        simpanJurnal();
      } finally {
        await hapusCloudinary(j.resource_type, "authenticated", j.public_id);
      }
    } catch (e) { gagal++; console.log(`  ✗ ${x.path}: ${e.message}`); }
  });
  console.log(`  ringkas: ${JALANKAN ? `${sukses} dikompres, ${gagal} gagal` : `${fmt(sebelum)} akan dikompres`}, ${lewat} dilewati (bukan media / < ${MIN_KB} KB / terlalu besar)${JALANKAN && sukses ? ` · ${fmt(sebelum)} → ${fmt(sesudah)}` : ""}`);
}

async function migrasiPrivat() {
  console.log("\n▶ MEDIA PRIVAT (dikompres, tetap di Supabase)");
  if (ikut("pesan")) {
    const rows = await ambilSemua("pesan_pribadi", "id,lampiran", "id.asc", "lampiran=not.is.null");
    const daftar = (rows || []).filter((r) => r.lampiran?.path && jenisMedia(r.lampiran.tipe, r.lampiran.nama || r.lampiran.path))
      .map((r) => ({ kunci: r.id, path: r.lampiran.path, tipe: r.lampiran.tipe, nama: r.lampiran.nama, tujuan: "pesan", baris: r }));
    await kompresPrivat("Pesan Pribadi", "pesan-pribadi", daftar, async (x, h) => {
      const l = x.baris.lampiran;
      await sb("PATCH", `pesan_pribadi?id=${eq(x.kunci)}`, { lampiran: { ...l, ukuran: h.ukuran, tipe: h.tipe, nama: namaDenganFormat(l.nama || "berkas", h.format) } });
    });
    if (JALANKAN) console.log("  ↳ jalankan migrasi-cloudinary-pemilik.sql sekali di Supabase SQL Editor (pemilik lampiran yang ditimpa).");
  }
  if (ikut("absen")) {
    const d = new Date(Date.now() + 7 * 3600000 - 7 * 86400000).toISOString().slice(0, 10);
    const rows = await ambilSemua("attendance", "id,tanggal,foto_masuk,foto_keluar", "id.asc", `tanggal=gte.${d}`);
    const daftar = [];
    (rows || []).forEach((r) => [r.foto_masuk, r.foto_keluar].filter(Boolean).forEach((p) => daftar.push({ kunci: r.id, path: p, tipe: "image/jpeg", nama: p, tujuan: "absen" })));
    await kompresPrivat("Selfie absen (7 hari)", "foto-absen", daftar, null);
  }
}

console.log(`Migrasi media → Cloudinary (${JALANKAN ? "JALANKAN" : "UJI — tidak ada yang diubah"})`);
console.log(`  Supabase : ${SUPA}\n  Cloudinary: ${CLD.cloudName} · folder ${CLD.folder}${HANYA.length ? `\n  hanya    : ${HANYA.join(", ")}` : ""}`);
try {
  if (["avatar", "stiker", "chat", "tugas", "dokumen", "setoran"].some(ikut)) await migrasiPublik();
  if (["pesan", "absen"].some(ikut)) await migrasiPrivat();
  console.log(JALANKAN ? "\nSelesai. Jurnal: scripts/migrasi-cloudinary.jurnal.json" : "\nUji selesai. Jalankan dengan --jalankan untuk memindahkan.");
} catch (e) {
  console.error("\n✗ Berhenti:", e?.message || e);
  process.exit(1);
}
