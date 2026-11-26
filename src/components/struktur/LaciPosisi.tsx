// src/components/struktur/LaciPosisi.tsx
// Rincian satu posisi: Jobdesk · SOP · Tugas rutin · KPI (dari Pedoman) · Riwayat (hanya @invisual.studio).
// Edit (hanya @invisual.studio): judul, pemegang manual, jobdesk, SOP, tugas rutin. Setiap simpan = versi baru;
// tabrakan dengan pengubah lain ditolak database (versi). Posisi staf dibuat saat pertama kali disimpan.
// Warna kartu (struktur-warna.sql, hanya @invisual.studio): dipilih dari palet, langsung tersimpan, tanpa versi baru.
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { renderPedoman } from "@/lib/management/pedomanRender";
import {
  BATAS, LABEL_DIVISI, LABEL_RITME, SUMBER_OTOMATIS, atasanDari, cariPosisiStaf, idRutinBaru, kpiDariPedoman, muatRiwayat,
  pastikanPosisiStaf, pisahPemegang, simpanPosisi, validasiRutin,
  type Bagan, type ButirRutin, type DataStruktur, type Posisi, type Ritme, type Staf, type SumberOtomatis, type VersiRiwayat,
} from "@/lib/struktur/struktur";
import { aturWarnaPosisi, teksKontras, type Palet } from "@/lib/struktur/warna";
import { Kosong, Lencana, PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama } from "@/components/management/ui";

export type Pilihan = { jenis: "simpul"; kunci: string; posisiId: string; nama: string | null } | { jenis: "staf"; staf: Staf };
type Tab = "jobdesk" | "sop" | "rutin" | "kpi" | "riwayat";

export const KELAS_MD = "text-sm leading-relaxed text-gray-300 [&_a]:text-tint [&_a]:underline [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:font-mono [&_h2]:text-[11px] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-tint first:[&_h2]:mt-0 [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-white [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:text-white [&_table]:my-2 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-xs [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/5 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5";

function Md({ md, kosong }: { md: string; kosong: string }) {
  const html = useMemo(() => renderPedoman(md), [md]);
  if (!md.trim()) return <p className="text-sm italic text-gray-500">{kosong}</p>;
  return <div className={KELAS_MD} dangerouslySetInnerHTML={{ __html: html }} />;
}

const waktuId = (iso?: string | null) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
};

function DaftarRutin({ rutin }: { rutin: ButirRutin[] }) {
  if (!rutin.length) return <p className="text-sm italic text-gray-500">Belum ada tugas rutin.</p>;
  return (
    <div className="grid gap-4">
      {(["harian", "mingguan", "bulanan"] as Ritme[]).map((r) => {
        const isi = rutin.filter((b) => b.ritme === r);
        if (!isi.length) return null;
        return (
          <div key={r}>
            <h3 className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-tint">{LABEL_RITME[r]}</h3>
            <ul className="grid gap-1">
              {isi.map((b) => (
                <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]">
                  <span className="text-gray-200">{b.judul}</span>
                  <span className="flex items-center gap-2">
                    {b.waktu ? <span className="font-mono text-[11px] text-gray-500">{b.waktu}</span> : null}
                    {b.otomatis ? <span title={SUMBER_OTOMATIS[b.otomatis]}><Lencana warna="biru">otomatis</Lencana></span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-xs text-gray-500">Tugas rutin muncul di Management → Tugas milik pemegang posisi ini. Yang bertanda <span className="text-cyan-300">otomatis</span> dicentang sistem dari data HRIS.</p>
    </div>
  );
}

function EditorRutin({ nilai, ubah }: { nilai: ButirRutin[]; ubah: (r: ButirRutin[]) => void }) {
  const set = (i: number, b: Partial<ButirRutin>) => ubah(nilai.map((x, j) => (j === i ? { ...x, ...b } : x)));
  const geser = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= nilai.length) return; const r = [...nilai]; [r[i], r[j]] = [r[j], r[i]]; ubah(r); };
  return (
    <div className="grid gap-2" data-editor-rutin>
      {nilai.map((b, i) => (
        <div key={b.id} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <input className={kelasInput} value={b.judul} maxLength={BATAS.judulRutin} onChange={(e) => set(i, { judul: e.target.value })} aria-label={`Judul tugas rutin ${i + 1}`} placeholder="Judul tugas" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[110px_1fr_1fr_auto]">
            <select className={kelasInput} value={b.ritme} onChange={(e) => set(i, { ritme: e.target.value as Ritme })} aria-label={`Ritme tugas ${i + 1}`}>
              {(["harian", "mingguan", "bulanan"] as Ritme[]).map((r) => <option key={r} value={r}>{LABEL_RITME[r]}</option>)}
            </select>
            <input className={kelasInput} value={b.waktu || ""} maxLength={BATAS.waktu} onChange={(e) => set(i, { waktu: e.target.value })} aria-label={`Waktu tugas ${i + 1}`} placeholder="Waktu (mis. 09.30–10.00)" />
            <select className={`${kelasInput} col-span-2 sm:col-span-1`} value={b.otomatis || ""} onChange={(e) => set(i, { otomatis: (e.target.value || undefined) as SumberOtomatis | undefined })} aria-label={`Cara centang tugas ${i + 1}`}>
              <option value="">Dicentang manual</option>
              {Object.entries(SUMBER_OTOMATIS).map(([k, l]) => <option key={k} value={k}>Otomatis: {l}</option>)}
            </select>
            <div className="col-span-2 flex gap-1 sm:col-span-1">
              <button type="button" className={kelasTombol} onClick={() => geser(i, -1)} disabled={i === 0} aria-label={`Naikkan tugas ${i + 1}`}>↑</button>
              <button type="button" className={kelasTombol} onClick={() => geser(i, 1)} disabled={i === nilai.length - 1} aria-label={`Turunkan tugas ${i + 1}`}>↓</button>
              <button type="button" className={kelasTombol} onClick={() => ubah(nilai.filter((_, j) => j !== i))} aria-label={`Hapus tugas ${i + 1}`}>Hapus</button>
            </div>
          </div>
        </div>
      ))}
      <button type="button" className={kelasTombol} disabled={nilai.length >= BATAS.rutin} onClick={() => ubah([...nilai, { id: idRutinBaru(nilai), judul: "", ritme: "harian" }])} data-tambah-rutin>+ Tambah tugas rutin</button>
    </div>
  );
}

/** Pilihan warna kartu dari palet. Satu posisi = satu warna (berlaku untuk semua kartu posisi ini). */
function PemilihWarna({ palet, aktif, catatan, sibuk, onPilih, onAturPalet }: {
  palet: Palet; aktif: string | null; catatan: string | null; sibuk: boolean; onPilih: (id: string | null) => void; onAturPalet?: () => void;
}) {
  return (
    <div className="grid gap-1.5" data-pemilih-warna>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-gray-500">Warna kartu</span>
        <button type="button" disabled={sibuk} onClick={() => onPilih(null)} aria-pressed={!aktif} aria-label="Tanpa warna" title="Tanpa warna" data-pilih-warna=""
          className={`grid size-7 place-items-center rounded-md border text-[13px] leading-none text-gray-500 disabled:opacity-50 ${!aktif ? "border-tint ring-2 ring-tint" : "border-dashed border-white/25 hover:border-white/50"}`}>⌀</button>
        {palet.warna.map((w) => (
          <button key={w.id} type="button" disabled={sibuk} onClick={() => onPilih(w.id)} aria-pressed={aktif === w.id} aria-label={`Warna ${w.nama}`} title={w.nama} data-pilih-warna={w.id}
            style={{ backgroundColor: w.hex, color: teksKontras(w.hex) }}
            className={`grid size-7 place-items-center rounded-md border text-[12px] font-black leading-none disabled:opacity-50 ${aktif === w.id ? "border-tint ring-2 ring-tint" : "border-white/20 hover:border-white/50"}`}>
            {aktif === w.id ? "✓" : ""}
          </button>
        ))}
        {onAturPalet && <button type="button" onClick={onAturPalet} className="ml-1 text-xs text-tint underline underline-offset-2" data-buka-palet>Atur palet</button>}
      </div>
      {catatan && <p className="text-xs text-gray-500">{catatan}</p>}
    </div>
  );
}

export default function LaciPosisi({ pilihan, data, bagan, portal, onTersimpan, onAturPalet }: {
  pilihan: Pilihan; data: DataStruktur; bagan: Bagan; portal: "admin" | "user"; onTersimpan: () => Promise<unknown>; onAturPalet?: () => void;
}) {
  void portal;
  const staf = pilihan.jenis === "staf" ? pilihan.staf : null;
  const posisiAsli: Posisi | null = pilihan.jenis === "simpul" ? data.posisi.find((p) => p.id === pilihan.posisiId) || null : cariPosisiStaf(data.posisi, staf!.divisi, staf!.jabatan);
  const posisi: Posisi | null = posisiAsli || (staf && staf.divisi && staf.jabatan
    ? { id: "", jenis: "staf", judul: staf.jabatan, divisi: staf.divisi, peran_mgmt: null, pemegang_manual: [], urutan: 100, jobdesk_md: "", sop_md: "", rutin: [], bagian_pedoman: null, versi: 0 }
    : null);
  const [tab, setTab] = useState<Tab>("jobdesk");
  const [edit, setEdit] = useState(false);
  const [draf, setDraf] = useState({ judul: "", pemegang: "", jobdesk: "", sop: "", rutin: [] as ButirRutin[], catatan: "" });
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<{ pesan: string; tabrakan?: boolean } | null>(null);
  const [riwayatMuat, setRiwayatMuat] = useState<{ kunci: string; isi: VersiRiwayat[] | null } | null>(null);
  const [lihatVersi, setLihatVersi] = useState<number | null>(null);
  const [yakinKembali, setYakinKembali] = useState<number | null>(null);
  const [pedoman, setPedoman] = useState<string | null | undefined>(undefined);
  const [sibukWarna, setSibukWarna] = useState(false);
  const [galatWarna, setGalatWarna] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "kpi" || pedoman !== undefined) return;
    let hidup = true;
    (async () => {
      try {
        const { data: v, error } = await supabase.from("mgmt_pedoman_versi").select("isi_md").eq("status", "berlaku").order("diterbitkan_pada", { ascending: false }).limit(1);
        if (hidup) setPedoman(!error && Array.isArray(v) && v[0]?.isi_md ? String(v[0].isi_md) : null);
      } catch { if (hidup) setPedoman(null); }
    })();
    return () => { hidup = false; };
  }, [tab, pedoman]);

  const idPosisi = posisiAsli?.id;
  const versiPosisi = posisiAsli?.versi;
  const kunciRiwayat = `${idPosisi}:${versiPosisi}`;
  useEffect(() => {
    if (tab !== "riwayat" || !idPosisi || !data.bolehEdit) return;
    let hidup = true;
    muatRiwayat(supabase, idPosisi).then((r) => { if (hidup) setRiwayatMuat({ kunci: kunciRiwayat, isi: r }); });
    return () => { hidup = false; };
  }, [tab, idPosisi, kunciRiwayat, data.bolehEdit]);
  const riwayat: VersiRiwayat[] | null | undefined = riwayatMuat && riwayatMuat.kunci === kunciRiwayat ? riwayatMuat.isi : undefined;

  const nama = pilihan.jenis === "simpul" ? pilihan.nama : staf!.nama;
  const atasan = posisi ? atasanDari(posisi, bagan) : "—";

  if (staf && (!staf.divisi || !staf.jabatan)) {
    return (
      <section className="grid gap-3 rounded-xl border border-white/10 bg-kartu p-5" data-laci>
        <div><span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Staf</span><h2 className="font-display text-xl font-bold text-white">{staf.nama}</h2>
          <p className="text-sm text-gray-400">{staf.jabatan || "Tanpa jabatan"}</p></div>
        <Kosong>{!staf.jabatan ? "Jabatan orang ini belum diisi di data Karyawan. Jobdesk staf ditulis per jabatan, jadi isi jabatannya dulu." : "Orang ini belum ditempatkan ke divisi. Jobdesk staf ditulis per jabatan di tiap divisi, jadi tempatkan dulu lewat \"Atur penempatan staf\"."}</Kosong>
      </section>
    );
  }
  if (!posisi) return <Kosong>Posisi tidak ditemukan. Muat ulang halaman.</Kosong>;

  const bisaEditTab = data.bolehEdit && (tab === "jobdesk" || tab === "sop" || (tab === "rutin" && posisi.jenis !== "staf"));
  const mulaiEdit = () => {
    setDraf({ judul: posisi.judul, pemegang: posisi.pemegang_manual.join(", "), jobdesk: posisi.jobdesk_md, sop: posisi.sop_md, rutin: posisi.rutin, catatan: "" });
    setGalat(null); setEdit(true);
  };
  const simpan = async (isi?: { judul: string; jobdesk: string; sop: string; rutin: ButirRutin[]; pemegang: string[]; catatan: string }) => {
    const nilai = isi || { judul: draf.judul.trim(), jobdesk: draf.jobdesk, sop: draf.sop, rutin: draf.rutin, pemegang: pisahPemegang(draf.pemegang), catatan: draf.catatan };
    if (!nilai.judul) return setGalat({ pesan: "Judul posisi wajib diisi." });
    const vr = validasiRutin(nilai.rutin);
    if (vr) return setGalat({ pesan: vr });
    setSibuk(true); setGalat(null);
    let id = posisi.id, versi = posisi.versi;
    if (!id && posisi.jenis === "staf" && posisi.divisi) {
      const b = await pastikanPosisiStaf(supabase, posisi.divisi, posisi.judul);
      if (!b.ok) { setSibuk(false); return setGalat({ pesan: b.pesan }); }
      id = b.id!; versi = b.versi;
    }
    const h = await simpanPosisi(supabase, { id, versi, ...nilai });
    setSibuk(false);
    if (!h.ok) return setGalat({ pesan: h.pesan, tabrakan: h.tabrakan });
    setEdit(false); setYakinKembali(null);
    await onTersimpan();
  };

  const pilihWarna = async (idWarna: string | null) => {
    if (idWarna === (posisi.warna || null)) return;
    setSibukWarna(true); setGalatWarna(null);
    let id = posisi.id;
    if (!id && posisi.jenis === "staf" && posisi.divisi) {
      const b = await pastikanPosisiStaf(supabase, posisi.divisi, posisi.judul);
      if (!b.ok) { setSibukWarna(false); return setGalatWarna(b.pesan); }
      id = b.id!;
    }
    const g = await aturWarnaPosisi(supabase, id, idWarna);
    if (g) setGalatWarna(g);
    await onTersimpan();
    setSibukWarna(false);
  };
  const jumlahKartu = pilihan.jenis === "simpul" ? bagan.owner.concat(bagan.sm, bagan.pendukung, bagan.divisi.flatMap((d) => d.leader)).filter((s) => s.posisi.id === posisi.id).length : 0;
  const catatanWarna = posisi.jenis === "staf" && posisi.divisi ? `Berlaku untuk semua ${posisi.judul} di divisi ${LABEL_DIVISI[posisi.divisi]}.`
    : jumlahKartu > 1 ? `Berlaku untuk ${jumlahKartu} kartu posisi ${posisi.judul}.` : null;

  const TAB: [Tab, string][] = [["jobdesk", "Jobdesk"], ["sop", "SOP"], ["rutin", "Tugas rutin"], ["kpi", "KPI"], ...(data.bolehEdit && posisiAsli ? [["riwayat", "Riwayat"] as [Tab, string]] : [])];
  const kpi = posisi.jenis === "staf" ? null : kpiDariPedoman(pedoman || "", posisi.bagian_pedoman);

  return (
    <section className="grid gap-4 rounded-xl border border-white/10 bg-kartu p-5" data-laci aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{posisi.jenis === "staf" ? "Staf" : "Peran"}</span>
          <h2 className="font-display text-xl font-bold text-white">{nama || "Belum ada pemegang"}</h2>
          <p className="text-sm text-gray-400">{posisi.jenis === "staf" && posisi.divisi ? `${posisi.judul} · ${LABEL_DIVISI[posisi.divisi]}` : posisi.judul}</p>
          <p className="mt-0.5 text-xs text-gray-500">Atasan: {atasan}</p>
        </div>
        {bisaEditTab && !edit && <button type="button" className={kelasTombol} onClick={mulaiEdit} data-edit-posisi>Edit</button>}
      </div>

      {data.bolehEdit && data.palet && !edit && (
        <div className="grid gap-2">
          <PemilihWarna palet={data.palet} aktif={posisi.warna || null} catatan={catatanWarna} sibuk={sibukWarna} onPilih={pilihWarna} onAturPalet={onAturPalet} />
          <PesanGalat pesan={galatWarna} />
        </div>
      )}

      <div role="tablist" aria-label="Rincian posisi" className="flex gap-4 overflow-x-auto border-b border-white/10">
        {TAB.map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} data-tab-laci={k}
            onClick={() => { if (edit) return; setTab(k); setLihatVersi(null); setYakinKembali(null); }}
            disabled={edit && tab !== k}
            className={`relative whitespace-nowrap py-2 text-sm transition-colors disabled:opacity-40 ${tab === k ? "font-semibold text-white after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-white" : "text-gray-400 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {edit ? (
        <div className="grid gap-3" data-mode-edit>
          {tab === "jobdesk" && posisi.jenis !== "staf" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={kelasLabel}>Judul posisi<input className={kelasInput} value={draf.judul} maxLength={BATAS.judul} onChange={(e) => setDraf({ ...draf, judul: e.target.value })} /></label>
              <label className={kelasLabel}>Pemegang tambahan (opsional)<input className={kelasInput} value={draf.pemegang} onChange={(e) => setDraf({ ...draf, pemegang: e.target.value })} placeholder="Pisahkan dengan koma" />
                <span className="font-normal text-gray-500">{posisi.peran_mgmt ? "Pemegang dari Management → Anggota sudah terisi otomatis." : "Nama yang tampil di bagan."}</span></label>
            </div>
          )}
          {tab === "jobdesk" && <label className={kelasLabel}>Jobdesk<textarea className={`${kelasInput} min-h-72 font-mono text-[12.5px] leading-relaxed`} value={draf.jobdesk} maxLength={BATAS.isi} onChange={(e) => setDraf({ ...draf, jobdesk: e.target.value })} /></label>}
          {tab === "sop" && <label className={kelasLabel}>SOP<textarea className={`${kelasInput} min-h-72 font-mono text-[12.5px] leading-relaxed`} value={draf.sop} maxLength={BATAS.isi} onChange={(e) => setDraf({ ...draf, sop: e.target.value })} /></label>}
          {tab === "rutin" && <EditorRutin nilai={draf.rutin} ubah={(r) => setDraf({ ...draf, rutin: r })} />}
          {tab !== "rutin" && <p className="text-xs text-gray-500">Format: <code className="rounded bg-white/10 px-1">## Judul bagian</code>, <code className="rounded bg-white/10 px-1">- butir</code>, <code className="rounded bg-white/10 px-1">**tebal**</code>.</p>}
          <label className={kelasLabel}>Catatan perubahan (opsional)<input className={kelasInput} value={draf.catatan} maxLength={BATAS.catatan} onChange={(e) => setDraf({ ...draf, catatan: e.target.value })} placeholder="Mis. tambah tugas brief sore" /></label>
          {galat && <div className="grid gap-2"><PesanGalat pesan={galat.pesan} />{galat.tabrakan && <button type="button" className={kelasTombol} onClick={() => { setEdit(false); setGalat(null); onTersimpan(); }}>Muat ulang</button>}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={kelasTombolUtama} onClick={() => simpan()} disabled={sibuk} data-simpan-posisi>{sibuk ? "Menyimpan…" : `Simpan sebagai v${posisi.id ? posisi.versi + 1 : 2}`}</button>
            <button type="button" className={kelasTombol} onClick={() => { setEdit(false); setGalat(null); }} disabled={sibuk}>Batal</button>
          </div>
          <p className="text-xs text-gray-500">Versi lama tetap tersimpan dan bisa dikembalikan dari tab Riwayat.</p>
        </div>
      ) : (
        <div data-isi-laci={tab}>
          {tab === "jobdesk" && <Md md={posisi.jobdesk_md} kosong={data.bolehEdit ? "Belum diisi. Tekan Edit untuk menulis jobdesk." : "Belum diisi."} />}
          {tab === "jobdesk" && posisi.jenis === "staf" && <p className="mt-3 text-xs text-gray-500">Jobdesk ini berlaku untuk semua {posisi.judul} di divisi {posisi.divisi ? LABEL_DIVISI[posisi.divisi] : ""}.</p>}
          {tab === "sop" && <Md md={posisi.sop_md} kosong={posisi.jenis === "staf" ? "Belum diisi. Staf mengikuti Pedoman Bagian 4: rencana di Daily Task 09.00–09.30, laporan sebelum 17.30." : "Belum diisi."} />}
          {tab === "rutin" && (posisi.jenis === "staf"
            ? <p className="text-sm text-gray-400">Staf memakai Daily Task untuk pekerjaan hariannya. Tugas rutin hanya untuk peran management.</p>
            : <DaftarRutin rutin={posisi.rutin} />)}
          {tab === "kpi" && (posisi.jenis === "staf"
            ? <p className="text-sm text-gray-400">KPI staf belum diatur di Pedoman.</p>
            : pedoman === undefined ? <p className="text-sm text-gray-500" aria-busy="true">Memuat KPI dari Pedoman…</p>
            : !posisi.bagian_pedoman ? <p className="text-sm text-gray-400">KPI untuk posisi ini belum diatur di Pedoman.</p>
            : !pedoman ? <p className="text-sm text-gray-400">Pedoman belum bisa dibaca dari akun ini.</p>
            : kpi ? <div className="grid gap-2"><Md md={kpi} kosong="" /><p className="text-xs text-gray-500">Sumber: Pedoman yang berlaku ({posisi.bagian_pedoman}). KPI berubah hanya lewat Usulan dan versi Pedoman baru.</p></div>
            : <p className="text-sm text-gray-400">Tabel KPI &quot;{posisi.bagian_pedoman}&quot; tidak ditemukan di Pedoman yang berlaku.</p>)}
          {tab === "riwayat" && (riwayat === undefined ? <p className="text-sm text-gray-500" aria-busy="true">Memuat riwayat…</p>
            : !riwayat ? <PesanGalat pesan="Riwayat tidak bisa dimuat." />
            : (
              <ul className="grid gap-0 divide-y divide-white/5" data-riwayat>
                {riwayat.map((v) => (
                  <li key={v.versi} className="grid gap-2 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 text-sm"><span className="font-semibold text-white">v{v.versi}</span> <span className="text-gray-300">{v.catatan || "Tanpa catatan"}</span>
                        <div className="text-xs text-gray-500">{v.diubah_oleh || "—"} · {waktuId(v.diubah_pada)}</div></div>
                      <div className="flex gap-1.5">
                        <button type="button" className={kelasTombol} onClick={() => setLihatVersi(lihatVersi === v.versi ? null : v.versi)} aria-expanded={lihatVersi === v.versi}>{lihatVersi === v.versi ? "Tutup" : "Lihat"}</button>
                        {v.versi === posisi.versi ? <Lencana warna="hijau">Berlaku</Lencana>
                          : <button type="button" className={kelasTombol} onClick={() => setYakinKembali(v.versi)} data-kembalikan={v.versi}>Kembalikan</button>}
                      </div>
                    </div>
                    {yakinKembali === v.versi && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        Kembalikan isi ke v{v.versi}? Ini menjadi versi baru; versi sekarang tetap tersimpan.
                        <button type="button" className={kelasTombolUtama} disabled={sibuk} data-yakin-kembalikan
                          onClick={() => simpan({ judul: v.judul, jobdesk: v.jobdesk_md, sop: v.sop_md, rutin: v.rutin, pemegang: v.pemegang_manual, catatan: `Kembalikan ke v${v.versi}` })}>{sibuk ? "Menyimpan…" : "Ya, kembalikan"}</button>
                        <button type="button" className={kelasTombol} onClick={() => setYakinKembali(null)} disabled={sibuk}>Batal</button>
                      </div>
                    )}
                    {lihatVersi === v.versi && (
                      <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-xs text-gray-400">Judul: <span className="text-white">{v.judul}</span>{v.pemegang_manual.length ? ` · Pemegang: ${v.pemegang_manual.join(", ")}` : ""}</p>
                        <div><h3 className="mb-1 text-xs font-semibold text-gray-400">Jobdesk</h3><Md md={v.jobdesk_md} kosong="Kosong" /></div>
                        <div><h3 className="mb-1 text-xs font-semibold text-gray-400">SOP</h3><Md md={v.sop_md} kosong="Kosong" /></div>
                        {posisi.jenis !== "staf" && <div><h3 className="mb-1 text-xs font-semibold text-gray-400">Tugas rutin</h3><DaftarRutin rutin={v.rutin} /></div>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ))}
          {galat && !edit && <div className="mt-3 grid gap-2"><PesanGalat pesan={galat.pesan} />{galat.tabrakan && <button type="button" className={kelasTombol} onClick={() => { setGalat(null); onTersimpan(); }}>Muat ulang</button>}</div>}
          {data.bolehEdit && posisiAsli?.diubah_oleh && tab !== "riwayat" && <p className="mt-4 text-xs text-gray-600">v{posisiAsli.versi} · diubah {posisiAsli.diubah_oleh} · {waktuId(posisiAsli.diubah_pada)}</p>}
        </div>
      )}
    </section>
  );
}
