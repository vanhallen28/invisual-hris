"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Search, X, CheckSquare, Megaphone, LayoutGrid, User, CornerDownLeft } from "lucide-react";

/**
 * Pencarian global — tekan Ctrl+K (atau ⌘K di Mac) di halaman mana pun.
 * Mencari tugas, brief konten, papan, dan karyawan sekaligus.
 * Hanya aktif saat sudah masuk.
 */

// Sesuaikan bila nama rute di proyekmu berbeda.
const RUTE_KARYAWAN = "/admin/karyawan";

type Hasil = {
  id: string;
  jenis: "tugas" | "brief" | "papan" | "karyawan";
  judul: string;
  keterangan?: string;
  boardId?: string;
};

const IKON: Record<Hasil["jenis"], any> = {
  tugas: CheckSquare,
  brief: Megaphone,
  papan: LayoutGrid,
  karyawan: User,
};

const LABEL: Record<Hasil["jenis"], string> = {
  tugas: "Tugas",
  brief: "Brief Konten",
  papan: "Papan",
  karyawan: "Karyawan",
};

const URUTAN: Hasil["jenis"][] = ["tugas", "brief", "papan", "karyawan"];

export default function GlobalSearch() {
  const pathname = usePathname() || "";
  const [buka, setBuka] = useState(false);
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Hasil[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [sorot, setSorot] = useState(0);
  const [masuk, setMasuk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const adminArea = pathname.startsWith("/admin");

  // Hanya aktif setelah login.
  useEffect(() => {
    let hidup = true;
    supabase.auth.getSession().then(({ data }) => { if (hidup) setMasuk(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setMasuk(!!s));
    return () => { hidup = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  // Pintasan papan tik.
  useEffect(() => {
    if (!masuk) return;
    const tekan = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuka((v) => !v);
      }
      if (e.key === "Escape") setBuka(false);
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [masuk]);

  useEffect(() => {
    if (buka) { setQ(""); setHasil([]); setSorot(0); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [buka]);

  const cari = useCallback(async (teks: string) => {
    const kata = teks.trim();
    if (kata.length < 2) { setHasil([]); return; }
    setSibuk(true);
    const pola = `%${kata}%`;
    const kumpulan: Hasil[] = [];

    try {
      // — Tugas, beserta papan induknya —
      const { data: items } = await supabase
        .from("items").select("id, name, group_id").ilike("name", pola).limit(8);
      if (items?.length) {
        const grupIds = [...new Set(items.map((i: any) => i.group_id).filter(Boolean))];
        const { data: grup } = await supabase
          .from("groups").select("id, title, board_id").in("id", grupIds);
        const petaGrup = Object.fromEntries((grup || []).map((g: any) => [g.id, g]));
        for (const it of items) {
          const g = petaGrup[it.group_id];
          kumpulan.push({
            id: it.id, jenis: "tugas", judul: it.name || "Tanpa nama",
            keterangan: g?.title, boardId: g?.board_id,
          });
        }
      }

      // — Brief konten —
      const { data: brief } = await supabase
        .from("content_posts").select("id, title, status, board_id").ilike("title", pola).limit(6);
      for (const b of brief || []) {
        kumpulan.push({ id: b.id, jenis: "brief", judul: b.title || "Tanpa judul", keterangan: b.status, boardId: b.board_id });
      }

      // — Papan —
      const { data: papan } = await supabase
        .from("tree_nodes").select("id, name, kind").eq("kind", "board").ilike("name", pola).limit(6);
      for (const p of papan || []) {
        kumpulan.push({ id: p.id, jenis: "papan", judul: p.name || "Tanpa nama", boardId: p.id });
      }

      // — Karyawan —
      const { data: kar } = await supabase
        .from("employees").select("id, nama, jabatan, divisi").ilike("nama", pola).limit(6);
      for (const k of kar || []) {
        kumpulan.push({
          id: String(k.id), jenis: "karyawan", judul: k.nama || "Tanpa nama",
          keterangan: [k.jabatan, k.divisi].filter(Boolean).join(" · "),
        });
      }
    } catch { /* diamkan — pencarian tidak boleh mengganggu halaman */ }

    setHasil(kumpulan);
    setSorot(0);
    setSibuk(false);
  }, []);

  // Tunda pencarian sampai ketikan berhenti sejenak.
  useEffect(() => {
    const t = setTimeout(() => { cari(q); }, 250);
    return () => clearTimeout(t);
  }, [q, cari]);

  const pilih = (h: Hasil) => {
    setBuka(false);
    if (h.jenis === "karyawan") { window.location.assign(RUTE_KARYAWAN); return; }
    if (h.boardId) {
      // Papan yang dituju disimpan dulu; halaman Daily Task membacanya saat dibuka.
      try { localStorage.setItem("dwt_active_board", h.boardId); } catch { /* abaikan */ }
    }
    window.location.assign(`${adminArea ? "/admin" : "/user"}/daily-task`);
  };

  // Susun berdasarkan jenis, tapi tetap satu daftar agar panah atas-bawah mulus.
  const urut = URUTAN.flatMap((j) => hasil.filter((h) => h.jenis === j));

  const tekanInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSorot((s) => Math.min(s + 1, urut.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSorot((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && urut[sorot]) { e.preventDefault(); pilih(urut[sorot]); }
  };

  if (!masuk || !buka) return null;

  let jenisTerakhir: string | null = null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[190]" onClick={() => setBuka(false)} />
      <div className="fixed left-1/2 top-[12vh] -translate-x-1/2 w-[92vw] max-w-xl bg-[#1e2029] border border-zinc-700 rounded-2xl shadow-2xl z-[200] overflow-hidden">

        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800">
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={tekanInput}
            placeholder="Cari tugas, brief, papan, atau karyawan…"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
          />
          {sibuk && <span className="text-[10px] text-zinc-600 shrink-0">mencari…</span>}
          <button onClick={() => setBuka(false)} className="p-1 text-zinc-600 hover:text-white shrink-0"><X size={14} /></button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          {q.trim().length < 2 && (
            <p className="text-[11px] text-zinc-600 px-4 py-6 text-center">Ketik minimal dua huruf untuk mulai mencari.</p>
          )}
          {q.trim().length >= 2 && !sibuk && urut.length === 0 && (
            <p className="text-[11px] text-zinc-600 px-4 py-6 text-center">Tidak ada yang cocok dengan &quot;{q.trim()}&quot;.</p>
          )}

          {urut.map((h, i) => {
            const Ikon = IKON[h.jenis];
            const kepala = h.jenis !== jenisTerakhir ? (jenisTerakhir = h.jenis) : null;
            return (
              <div key={`${h.jenis}-${h.id}`}>
                {kepala && (
                  <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">{LABEL[h.jenis]}</div>
                )}
                <button
                  onClick={() => pilih(h)} onMouseEnter={() => setSorot(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === sorot ? "bg-blue-600/15" : "hover:bg-zinc-800/50"}`}
                >
                  <Ikon size={14} className={`shrink-0 ${i === sorot ? "text-blue-300" : "text-zinc-600"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] truncate ${i === sorot ? "text-white font-semibold" : "text-zinc-300"}`}>{h.judul}</p>
                    {h.keterangan && <p className="text-[10px] text-zinc-600 truncate">{h.keterangan}</p>}
                  </div>
                  {i === sorot && <CornerDownLeft size={12} className="text-zinc-600 shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-800 text-[9px] text-zinc-600">
          <span>↑↓ pilih</span><span>Enter buka</span><span>Esc tutup</span>
        </div>
      </div>
    </>
  );
}
