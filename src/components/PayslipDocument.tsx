// src/components/PayslipDocument.tsx
// Template slip gaji bersama (HTML) — dipakai halaman Payroll, Profil karyawan,
// dan detail karyawan lewat SlipModal. Angka diambil dari `SlipTampil`
// (lib/payroll/hitung.ts) sehingga slip di semua halaman identik, dan versi PDF
// (lib/payroll/slipPdf.ts) mengikuti susunan yang sama.
//   slip      : hasil keSlipTampil(barisSlip)
//   monthName : label periode, mis. "Oktober 2026"
//   draf      : true → pita "DRAF — belum final" (periode belum difinalkan)
import { PERUSAHAAN } from "@/lib/payroll/perusahaan";
import { formatRupiah, type SlipTampil } from "@/lib/payroll/hitung";

export default function PayslipDocument({ slip, monthName, draf = false }: { slip: SlipTampil; monthName: string; draf?: boolean }) {
  return (
    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-black print:overflow-visible print:p-8" id="printable-slip" data-slip={slip.idKaryawan}>

      {draf && (
        <div className="mb-3 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold px-3 py-1.5 text-center tracking-wider" data-slip-draf>
          DRAF — belum final
        </div>
      )}

      {/* KOP SURAT */}
      <div className="flex justify-between items-center border-b-2 border-black/10 pb-4 mb-4">
        <div>
          <img src="/invisual-light.svg" alt={PERUSAHAAN.nama} className="h-7 object-contain mb-1 brightness-0" />
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{PERUSAHAAN.departemen}</p>
          <p className="text-[10px] text-gray-400 font-medium">Periode: {monthName}</p>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-black text-primer-terang uppercase tracking-widest">Payslip</h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">DOC-{slip.idKaryawan}</p>
        </div>
      </div>

      {/* Info Karyawan */}
      <div className="grid grid-cols-2 gap-4 mb-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
        <div>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Informasi Karyawan</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">{slip.nama}</p>
          <p className="text-xs text-gray-600 font-mono">{slip.idKaryawan} • {slip.jabatan}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Transfer Tujuan</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">{slip.namaBank}</p>
          <p className="text-xs text-gray-600 font-mono">{slip.noRekening}</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-500 mb-5 px-1" data-slip-kehadiran>
        Kehadiran periode ini: <span className="font-bold text-gray-700">Hadir {slip.hadir} hari</span> · <span className={`font-bold ${slip.telat > 0 ? "text-amber-600" : "text-gray-700"}`}>Telat {slip.telat} hari</span>
      </p>

      {/* Rincian Finansial */}
      <div className="grid grid-cols-2 gap-6 mb-5">
        <div>
          <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest border-b border-gray-200 pb-1.5 mb-2">Pendapatan (Earnings)</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Gaji Pokok</span>
              <span className="font-bold text-gray-800">{formatRupiah(slip.gajiPokok)}</span>
            </div>
            {slip.bonusManual > 0 && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Bonus Tambahan</span>
                <span>{formatRupiah(slip.bonusManual)}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between text-xs font-bold mt-3 pt-2 border-t border-gray-200">
            <span className="text-gray-800">Total Pendapatan</span>
            <span className="text-green-600">{formatRupiah(slip.totalPendapatan)}</span>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest border-b border-gray-200 pb-1.5 mb-2">Potongan (Deductions)</h3>
          <div className="space-y-2 text-xs">
            {slip.potonganManual > 0 ? (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Kasbon / Potongan Ekstra</span>
                <span>-{formatRupiah(slip.potonganManual)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-gray-500 italic text-[11px]">
                <span>Tidak ada potongan</span>
                <span>Rp 0</span>
              </div>
            )}
          </div>
          <div className="flex justify-between text-xs font-bold mt-3 pt-2 border-t border-gray-200">
            <span className="text-gray-800">Total Potongan</span>
            <span className="text-red-600">-{formatRupiah(slip.totalPotongan)}</span>
          </div>
        </div>
      </div>

      {/* THP */}
      <div className="bg-primer-terang text-white p-4 rounded-xl flex justify-between items-center shadow-md mb-5">
        <div>
          <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Take Home Pay</p>
          <p className="text-[9px] text-blue-300 mt-0.5">Total bersih ditransfer ke rekening di atas.</p>
        </div>
        <p className="text-xl font-black" data-slip-thp>{formatRupiah(slip.gajiBersih)}</p>
      </div>

      {slip.catatan && (
        <div className="mb-5 text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2" data-slip-catatan>
          <span className="font-bold text-gray-700">Catatan: </span>{slip.catatan}
        </div>
      )}

      {/* AREA FOOTER (TANDA TANGAN & ALAMAT) */}
      <div>
        <div className="pt-2 flex justify-between text-center text-xs mb-6">
          <div>
            <p className="text-gray-500 mb-6">Diterima Oleh,</p>
            <p className="font-bold text-gray-800 underline underline-offset-4">{slip.nama}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-6">Disetujui Oleh,</p>
            <p className="font-bold text-gray-800 underline underline-offset-4">HR Manager</p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 text-left">
          <p className="text-[10px] font-black text-gray-700 tracking-widest uppercase">{PERUSAHAAN.nama}</p>
          <p className="text-[9px] text-gray-500 mt-1 font-medium leading-relaxed">{PERUSAHAAN.alamat}</p>
          <p className="text-[9px] text-gray-400 mt-0.5 font-mono">📞 {PERUSAHAAN.telepon}</p>
        </div>
      </div>

    </div>
  );
}
