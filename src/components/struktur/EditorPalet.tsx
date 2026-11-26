// src/components/struktur/EditorPalet.tsx
// Palet warna kartu Struktur (hanya akun @invisual.studio). Nama warna = legenda di atas bagan.
// Simpan sekaligus (versi; tabrakan ditolak database). Warna yang dihapus → kartu pemakainya kembali tanpa warna.
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Posisi } from "@/lib/struktur/struktur";
import {
  BATAS_PALET, PALET_BAWAAN, idWarnaBaru, normalHex, pemakaianWarna, simpanPalet, validasiPalet,
  type Palet, type WarnaPalet,
} from "@/lib/struktur/warna";
import { PesanGalat, kelasInput, kelasTombol, kelasTombolUtama } from "@/components/management/ui";

const kelasIsian = kelasInput.replace("w-full ", "");   // lebar diatur per kolom baris palet

export default function EditorPalet({ palet, posisi, onTersimpan, onTutup }: {
  palet: Palet; posisi: Posisi[]; onTersimpan: () => Promise<unknown>; onTutup: () => void;
}) {
  const [draf, setDraf] = useState<WarnaPalet[]>(palet.warna);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<{ pesan: string; tabrakan?: boolean } | null>(null);
  const pakai = pemakaianWarna(posisi);
  const idDraf = new Set(draf.map((w) => w.id));
  const dilepas = [...pakai.entries()].filter(([id]) => !idDraf.has(id)).reduce((n, [, k]) => n + k, 0);
  const ubah = (i: number, w: Partial<WarnaPalet>) => setDraf(draf.map((x, j) => (j === i ? { ...x, ...w } : x)));
  const tambah = () => {
    const dipakai = new Set(draf.map((w) => normalHex(w.hex)));
    const hex = PALET_BAWAAN.find((w) => !dipakai.has(w.hex))?.hex || "#9aa2b6";
    setDraf([...draf, { id: idWarnaBaru(draf), nama: "", hex }]);
  };
  const simpan = async () => {
    const rapi = draf.map((w) => ({ ...w, nama: w.nama.trim(), hex: normalHex(w.hex) || w.hex }));
    const v = validasiPalet(rapi);
    if (v) return setGalat({ pesan: v });
    setSibuk(true); setGalat(null);
    const h = await simpanPalet(supabase, palet.versi, rapi);
    setSibuk(false);
    if (!h.ok) return setGalat({ pesan: h.pesan, tabrakan: h.tabrakan });
    await onTersimpan();
    onTutup();
  };

  return (
    <section className="grid gap-4 rounded-xl border border-white/10 bg-kartu p-4 md:p-5" data-editor-palet aria-label="Palet warna">
      <div>
        <h2 className="text-base font-bold text-white">Palet warna</h2>
        <p className="text-xs text-gray-400">Warna yang bisa dipilih untuk kartu. Namanya tampil sebagai legenda di atas bagan, mis. &quot;Pimpinan&quot; atau &quot;Kreatif&quot;. Pilih warna kartu dengan mengeklik kartunya.</p>
      </div>
      <ul className="grid gap-2 xl:grid-cols-2">
        {draf.map((w, i) => {
          const hexSah = normalHex(w.hex);
          const n = pakai.get(w.id) || 0;
          return (
            <li key={w.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2" data-warna-palet={w.id}>
              <input type="color" value={hexSah || "#000000"} onChange={(e) => ubah(i, { hex: e.target.value })} aria-label={`Pilih warna ${i + 1}`}
                className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-white/15 bg-transparent p-0.5" />
              <input className={`${kelasIsian} min-w-0 flex-1 basis-40`} value={w.nama} maxLength={BATAS_PALET.nama} onChange={(e) => ubah(i, { nama: e.target.value })}
                placeholder="Nama, mis. Pimpinan" aria-label={`Nama warna ${i + 1}`} />
              <input className={`${kelasIsian} w-28 shrink-0 font-mono text-xs ${hexSah ? "" : "border-red-500/60"}`} value={w.hex} maxLength={7} onChange={(e) => ubah(i, { hex: e.target.value })}
                aria-label={`Kode warna ${i + 1}`} aria-invalid={!hexSah} spellCheck={false} />
              <span className="w-16 shrink-0 text-right text-[11px] text-gray-500" title="Jumlah posisi yang memakai warna ini" data-pakai-warna={w.id}>{n ? `${n} posisi` : "—"}</span>
              <button type="button" className={kelasTombol} onClick={() => setDraf(draf.filter((_, j) => j !== i))} aria-label={`Hapus warna ${w.nama || i + 1}`} data-hapus-warna={w.id}>Hapus</button>
            </li>
          );
        })}
        {draf.length === 0 && <li className="text-sm text-gray-500">Palet kosong. Kartu tampil tanpa warna.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={kelasTombol} onClick={tambah} disabled={draf.length >= BATAS_PALET.jumlah} data-tambah-warna>+ Tambah warna</button>
        <button type="button" className={kelasTombol} onClick={() => setDraf(PALET_BAWAAN)} data-palet-bawaan>Pakai palet bawaan</button>
      </div>
      {dilepas > 0 && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" data-peringatan-lepas>
          {dilepas} posisi memakai warna yang dihapus dan kartunya akan kembali tanpa warna setelah palet disimpan.
        </p>
      )}
      {galat && <div className="grid gap-2"><PesanGalat pesan={galat.pesan} />
        {galat.tabrakan && <button type="button" className={kelasTombol} onClick={async () => { await onTersimpan(); onTutup(); }}>Muat ulang</button>}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={kelasTombolUtama} onClick={simpan} disabled={sibuk} data-simpan-palet>{sibuk ? "Menyimpan…" : "Simpan palet"}</button>
        <button type="button" className={kelasTombol} onClick={onTutup} disabled={sibuk}>Batal</button>
      </div>
    </section>
  );
}
