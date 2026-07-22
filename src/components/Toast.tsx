"use client";

import { createContext, useContext, useCallback, useState, useRef } from "react";

/**
 * Toast global INVISUAL.
 *
 * Menggantikan alert()/confirm() bawaan peramban, yang tampil di luar
 * tema aplikasi dan memutus alur. Gayanya mengikuti toast yang sudah
 * dipakai di halaman Kehadiran, dinaikkan menjadi satu sistem yang bisa
 * dipanggil dari mana saja lewat hook useToast().
 *
 * Palet dikunci ke portal:
 *   sukses  hijau  · gagal  merah  · info  biru #124bce/#8ba7ff
 *   kartu   #15121A · tepi rgba(255,255,255,.10)
 *
 * Pemakaian:
 *   const toast = useToast();
 *   toast.sukses("Data tersimpan");
 *   toast.gagal("Gagal menyimpan");
 *   toast.info("Sedang diproses…");
 *   const ya = await toast.konfirmasi("Hapus item ini?");   // ganti confirm()
 */

type Jenis = "sukses" | "gagal" | "info";

type Toast = {
  id: number;
  jenis: Jenis;
  pesan: string;
};

type Konfirmasi = {
  id: number;
  pesan: string;
  labelYa: string;
  labelTidak: string;
  resolve: (nilai: boolean) => void;
};

type ToastAPI = {
  sukses: (pesan: string) => void;
  gagal: (pesan: string) => void;
  info: (pesan: string) => void;
  konfirmasi: (pesan: string, opsi?: { labelYa?: string; labelTidak?: string }) => Promise<boolean>;
};

const Ctx = createContext<ToastAPI | null>(null);

// Jatuh ke no-op yang aman kalau dipakai di luar provider, supaya
// komponen tidak meledak hanya karena lupa membungkusnya.
export function useToast(): ToastAPI {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    sukses: () => {},
    gagal: () => {},
    info: () => {},
    konfirmasi: async () => false,
  };
}

const GAYA: Record<Jenis, { garis: string; kotak: string; label: string; teks: string }> = {
  sukses: {
    garis: "bg-green-400",
    kotak: "bg-green-500/15 text-green-400",
    label: "text-green-400",
    teks: "Berhasil",
  },
  gagal: {
    garis: "bg-red-400",
    kotak: "bg-red-500/15 text-red-400",
    label: "text-red-400",
    teks: "Gagal",
  },
  info: {
    garis: "bg-[#124bce]",
    kotak: "bg-[#124bce]/15 text-[#8ba7ff]",
    label: "text-[#8ba7ff]",
    teks: "Info",
  },
};

function Ikon({ jenis }: { jenis: Jenis }) {
  const c = "w-5 h-5";
  if (jenis === "sukses")
    return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={c}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
  if (jenis === "gagal")
    return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={c}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
  return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={c}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [konfirmasi, setKonfirmasi] = useState<Konfirmasi | null>(null);
  const urutan = useRef(0);

  const tampil = useCallback((jenis: Jenis, pesan: string) => {
    const id = ++urutan.current;
    setToasts((t) => [...t, { id, jenis, pesan }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const api: ToastAPI = {
    sukses: (p) => tampil("sukses", p),
    gagal: (p) => tampil("gagal", p),
    info: (p) => tampil("info", p),
    konfirmasi: (pesan, opsi) =>
      new Promise<boolean>((resolve) => {
        setKonfirmasi({
          id: ++urutan.current,
          pesan,
          labelYa: opsi?.labelYa || "Ya",
          labelTidak: opsi?.labelTidak || "Batal",
          resolve,
        });
      }),
  };

  const tutupKonfirmasi = (nilai: boolean) => {
    konfirmasi?.resolve(nilai);
    setKonfirmasi(null);
  };

  return (
    <Ctx.Provider value={api}>
      {children}

      {/* Tumpukan toast */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-sm flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const g = GAYA[t.jenis];
          return (
            <div
              key={t.id}
              className="relative flex items-center gap-3.5 bg-[#15121A] border border-white/10 rounded-2xl shadow-2xl px-4 py-3.5 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto"
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${g.garis}`} />
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${g.kotak}`}>
                <Ikon jenis={t.jenis} />
              </div>
              <div className="flex-1 min-w-0 pr-1">
                <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${g.label}`}>{g.teks}</p>
                <p className="text-[13px] font-semibold text-white leading-snug">{t.pesan}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog konfirmasi — pengganti confirm() bawaan */}
      {konfirmasi && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[10001]" onClick={() => tutupKonfirmasi(false)} />
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-sm bg-[#15121A] border border-white/10 rounded-2xl shadow-2xl p-5 pointer-events-auto animate-in zoom-in-95 fade-in duration-200">
              <p className="text-sm text-white leading-relaxed mb-5">{konfirmasi.pesan}</p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => tutupKonfirmasi(false)}
                  className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-gray-300 transition-colors"
                >
                  {konfirmasi.labelTidak}
                </button>
                <button
                  onClick={() => tutupKonfirmasi(true)}
                  className="flex-1 h-10 rounded-xl bg-[#2b5cd5] hover:bg-[#124bce] text-sm font-semibold text-white transition-colors active:scale-[0.99]"
                >
                  {konfirmasi.labelYa}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Ctx.Provider>
  );
}
