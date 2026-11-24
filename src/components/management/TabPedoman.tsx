// src/components/management/TabPedoman.tsx
// Tab Pedoman: baca & konfirmasi (semua orang), riwayat versi, editor & terbitkan (PM/SM), status baca.
// bacaSaja (halaman /user/pedoman) → hanya "Pedoman berlaku" dan "Riwayat versi".
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { teksTanggal, teksTanggalISO } from "@/lib/tanggalTampil";
import { adalahLeader, bisa, DIVISI_LABEL, type PeranManagement } from "@/lib/management/akses";
import { konfirmasiBaca, muatAturanInternal, muatVersi, sudahBaca, type AturanInternal, type VersiPedoman } from "@/lib/management/pedoman";
import { judulDariHtml, renderPedoman } from "@/lib/management/pedomanRender";
import { kabariPedomanBerubah } from "./useMenuManagement";
import { Kosong, Lencana, PesanGalat, kelasTombolUtama } from "./ui";
import RiwayatPedoman from "./RiwayatPedoman";
import EditorPedoman from "./EditorPedoman";
import StatusBaca from "./StatusBaca";

type Sub = "baca" | "riwayat" | "editor" | "status";

export default function TabPedoman({ peran, divisi, bacaSaja = false, subAwal }: { peran: PeranManagement[]; divisi: string[]; bacaSaja?: boolean; subAwal?: string | null }) {
  const [versi, setVersi] = useState<VersiPedoman[] | null | undefined>(undefined);   // undefined = memuat; null = belum dipasang
  const [sub, setSub] = useState<Sub>(subAwal === "riwayat" || subAwal === "editor" || subAwal === "status" ? subAwal : "baca");
  const muat = useCallback(async () => { setVersi(await muatVersi(supabase)); }, []);
  useEffect(() => {
    let hidup = true;
    muatVersi(supabase).then((v) => { if (hidup) setVersi(v); });
    return () => { hidup = false; };
  }, []);

  const bolehEditor = !bacaSaja && bisa(peran, "terbitkan_pedoman");
  const bolehStatus = !bacaSaja && (bisa(peran, "lihat_status_baca_semua") || adalahLeader(peran));
  const subs: { k: Sub; l: string }[] = [{ k: "baca", l: "Pedoman berlaku" }, { k: "riwayat", l: "Riwayat versi" }];
  if (bolehEditor) subs.push({ k: "editor", l: "Editor & terbitkan" });
  if (bolehStatus) subs.push({ k: "status", l: "Status baca" });

  if (versi === undefined) return <p className="py-10 text-center text-sm text-gray-500" aria-busy="true">Memuat Pedoman…</p>;
  if (versi === null) return <Kosong>Pedoman belum tersedia.</Kosong>;
  const berlaku = versi.find((v) => v.status === "berlaku") || null;

  return (
    <div className="space-y-4" data-tab-pedoman>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bagian Pedoman">
        {subs.map((s) => (
          <button key={s.k} type="button" aria-pressed={sub === s.k} data-sub-pedoman={s.k} onClick={() => setSub(s.k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${sub === s.k ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"}`}>
            {s.l}
          </button>
        ))}
      </div>
      {sub === "baca" && (berlaku
        ? <BacaPedoman versi={berlaku} />
        : <Kosong>Belum ada Pedoman yang berlaku.{bolehEditor ? <> — <button type="button" className="underline text-tint cursor-pointer" onClick={() => setSub("editor")}>Buka editor</button></> : null}</Kosong>)}
      {sub === "riwayat" && <RiwayatPedoman versi={versi} management={!bacaSaja && peran.length > 0} />}
      {sub === "editor" && bolehEditor && <EditorPedoman versi={versi} peran={peran} onTerbit={async () => { await muat(); kabariPedomanBerubah(); setSub("baca"); }} onSimpan={muat} />}
      {sub === "status" && bolehStatus && berlaku && <StatusBaca versi={berlaku} peran={peran} divisi={divisi} />}
      {sub === "status" && bolehStatus && !berlaku && <Kosong>Status baca muncul setelah ada Pedoman yang berlaku.</Kosong>}
    </div>
  );
}

/** Isi Pedoman yang berlaku + daftar isi + aturan internal + konfirmasi baca (aktif setelah digulir ke akhir). */
function BacaPedoman({ versi }: { versi: VersiPedoman }) {
  const [uid, setUid] = useState<string | null>(null);
  const [dibaca, setDibaca] = useState<boolean | null>(null);
  const [sampaiAkhir, setSampaiAkhir] = useState(false);
  const [aturan, setAturan] = useState<AturanInternal[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const penanda = useRef<HTMLDivElement>(null);
  // Komponen ini baru dirender setelah data dimuat di peramban → aman membaca window di sini.
  const [tocBuka, setTocBuka] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);   // desktop terbuka; ponsel dilipat
  const html = useMemo(() => renderPedoman(versi.isi_md), [versi.isi_md]);
  const toc = useMemo(() => judulDariHtml(html), [html]);   // dari HTML hasil render → id selalu cocok
  useEffect(() => {
    let hidup = true;
    (async () => {
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const id = data?.user?.id || null;
      const [sudah, internal] = await Promise.all([id ? sudahBaca(supabase, versi.id, id) : Promise.resolve(false), muatAturanInternal(supabase)]);
      if (!hidup) return;
      setUid(id); setDibaca(sudah); setAturan(internal);
    })();
    return () => { hidup = false; };
  }, [versi.id]);
  useEffect(() => {
    const el = penanda.current;
    if (!el || sampaiAkhir || dibaca !== false) return;
    const io = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { setSampaiAkhir(true); io.disconnect(); } });
    io.observe(el);
    return () => io.disconnect();
  }, [dibaca, sampaiAkhir, html]);

  const konfirmasi = async () => {
    if (!uid) return;
    setSibuk(true); setGalat("");
    const r = await konfirmasiBaca(supabase, versi.id, uid);
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan konfirmasi."); return; }
    setDibaca(true);
    kabariPedomanBerubah();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Daftar isi" className="lg:sticky lg:top-4 lg:self-start">
        <details className="rounded-xl border border-white/10 bg-kartu p-3" open={tocBuka} onToggle={(e) => setTocBuka((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-gray-500">Daftar isi</summary>
          <ol className="mt-2 grid gap-0.5 text-[13px]">
            {toc.map((j) => (
              <li key={j.id}><a href={`#${j.id}`} className={`block rounded-md px-2 py-1 text-gray-400 hover:bg-white/5 hover:text-white ${j.level === 3 ? "pl-5 text-xs" : ""}`}>{j.teks}</a></li>
            ))}
            <li><a href="#aturan-internal-divisi" className="block rounded-md px-2 py-1 text-gray-400 hover:bg-white/5 hover:text-white">Aturan internal divisi</a></li>
          </ol>
        </details>
      </nav>
      <article className="min-w-0 rounded-xl border border-white/10 bg-kartu p-5 md:p-7" data-isi-pedoman>
        <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-white/5 pb-4">
          <h2 className="font-display text-xl font-bold text-white">Pedoman {versi.versi}</h2>
          <Lencana warna="hijau">Berlaku</Lencana>
          {versi.berlaku_mulai ? <span className="text-xs text-gray-500">mulai {teksTanggalISO(versi.berlaku_mulai)}</span> : null}
        </div>
        <div className="max-w-[72ch] text-sm leading-relaxed text-gray-300 [&_a]:text-tint [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:text-white [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:scroll-mt-20 [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-white [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:scroll-mt-20 [&_h3]:font-semibold [&_h3]:text-white [&_hr]:my-6 [&_hr]:border-white/10 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/40 [&_pre]:p-3 [&_strong]:text-white [&_table]:my-3 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-white/10 [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/5 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: html }} />
        <section id="aturan-internal-divisi" className="mt-8 scroll-mt-20 border-t border-white/5 pt-5" data-aturan-internal>
          <h2 className="font-display text-lg text-white">Aturan internal divisi</h2>
          <p className="mt-1 text-xs text-gray-500">Otomatis dari usulan jalur internal yang berlaku. Bagian ini tidak menaikkan versi.</p>
          {aturan.length === 0
            ? <p className="mt-3 text-sm text-gray-400">Belum ada aturan internal divisi.</p>
            : <ul className="mt-3 grid gap-2">{aturan.map((a) => (
                <li key={a.nomor} className="rounded-lg border border-white/5 bg-input p-3 text-sm">
                  <p className="text-white"><span className="font-mono text-xs text-gray-500">{a.nomor}</span> · <b>{a.judul}</b> · {(a.divisi || []).map((d) => DIVISI_LABEL[d] || d).join(", ")}{a.berlaku_sejak ? <> · berlaku {teksTanggal(String(a.berlaku_sejak).slice(0, 10))}</> : null}</p>
                  <p className="mt-1 text-gray-400">{a.perubahan}</p>
                </li>))}</ul>}
        </section>
        <div ref={penanda} aria-hidden className="h-px" data-penanda-akhir />
        <div className="mt-6 grid gap-2 rounded-xl border border-white/10 bg-input p-4" data-konfirmasi-pedoman>
          {dibaca === null ? null : dibaca ? (
            <p className="text-sm text-emerald-300" role="status">Anda sudah mengonfirmasi membaca Pedoman {versi.versi}.</p>
          ) : (
            <>
              <p className="text-xs text-gray-400">{sampaiAkhir ? "Anda sudah sampai akhir. Tekan konfirmasi di bawah." : "Gulir sampai akhir untuk mengaktifkan tombol konfirmasi."} Konfirmasi tidak memblokir Clock In, Daily Task, maupun Chat.</p>
              <PesanGalat pesan={galat} />
              <div><button type="button" className={kelasTombolUtama} disabled={!sampaiAkhir || sibuk || !uid} onClick={konfirmasi} data-tombol-konfirmasi>{sibuk ? "Menyimpan…" : `Saya sudah membaca ${versi.versi}`}</button></div>
            </>
          )}
        </div>
      </article>
    </div>
  );
}

