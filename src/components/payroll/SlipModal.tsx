// src/components/payroll/SlipModal.tsx
// Jendela slip gaji bersama: PayslipDocument + tombol Tutup / Unduh PDF / Print.
// Dipakai halaman Payroll (HR), Profil (karyawan), dan detail karyawan (HR).
// Dirender ke <body> lewat portal: kartu induk memakai transform saat hover
// (kartu-glow), yang membuat `fixed` terkurung di dalam kartu (pelajaran
// Kalender Cuti). CSS cetak ikut di sini agar window.print() hanya mencetak slip.
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import PayslipDocument from "@/components/PayslipDocument";
import { namaBerkasSlip, type SlipTampil } from "@/lib/payroll/hitung";
import { unduhSlipPdf } from "@/lib/payroll/unduhSlip"; // jsPDF dimuat saat tombol ditekan

const CSS_CETAK = `
@media print {
  body * { visibility: hidden !important; }
  #printable-slip, #printable-slip * { visibility: visible !important; }
  #printable-slip {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 20px !important;
  }
}`;

export default function SlipModal({ slip, label, draf = false, onTutup }: { slip: SlipTampil; label: string; draf?: boolean; onTutup: () => void }) {
  // Escape menutup jendela (pendengar dipasang di effect; tanpa setState sinkron).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTutup]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:bg-white print:p-0"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onTutup(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Slip gaji ${slip.nama} — ${label}`}
      data-slip-modal
    >
      <div className="permukaan-terang bg-white w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden print:max-w-full print:rounded-none print:max-h-full print:overflow-visible relative print:shadow-none">
        <PayslipDocument slip={slip} monthName={label} draf={draf} />

        <div className="p-4 flex flex-wrap justify-end gap-3 print:hidden border-t border-gray-200 bg-gray-100 shrink-0">
          <button type="button" onClick={onTutup} className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Tutup</button>
          <button
            type="button"
            onClick={() => unduhSlipPdf(slip, label, namaBerkasSlip(label, slip.nama), { draf })}
            className="px-5 py-2 text-sm font-bold text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            data-unduh-pdf
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Unduh PDF
          </button>
          <button type="button" onClick={() => window.print()} className="px-5 py-2 text-sm font-bold text-white bg-primer-terang hover:bg-blue-600 rounded-lg flex items-center gap-2 shadow-md transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.724.092m6.524-4.659A15.455 15.455 0 0112.532 2.25H8.25m4.282 7.02v.002m0 0H21m-2.81 8.51c-.145.52-.36 1.018-.632 1.487M12 21.75c-2.676 0-5.216-.584-7.499-1.632M15.75 21.75c2.676 0 5.216-.584 7.499-1.632M4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75z" /></svg>
            Print / Simpan PDF
          </button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS_CETAK }} />
    </div>,
    document.body,
  );
}
