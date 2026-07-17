// src/components/PayslipDocument.tsx
// Template slip gaji bersama — SALINAN PERSIS markup slip di halaman Payroll,
// agar slip di Profil identik dengan slip Payroll. `slip` berisi field terhitung
// (gajiPokok, totalHadir, tunjanganKehadiran, bonusManual, potonganManual,
// totalPendapatan, totalPotongan, gajiBersih) + data karyawan (nama, idKaryawan,
// jabatan, namaBank, noRekening). `monthName` = nama periode.

const formatRupiah = (angka: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka || 0);

export default function PayslipDocument({ slip, monthName }: { slip: any; monthName: string }) {
  return (
    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-black print:overflow-visible print:p-8" id="printable-slip">

      {/* KOP SURAT */}
      <div className="flex justify-between items-center border-b-2 border-black/10 pb-4 mb-4">
        <div>
          <img src="/invisual-light.svg" alt="Invisual Studio" className="h-7 object-contain mb-1 brightness-0" />
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">HR & Payroll Department</p>
          <p className="text-[10px] text-gray-400 font-medium">Periode: {monthName}</p>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-black text-[#2b5cd5] uppercase tracking-widest">Payslip</h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">DOC-{slip.idKaryawan}</p>
        </div>
      </div>

      {/* Info Karyawan */}
      <div className="grid grid-cols-2 gap-4 mb-5 bg-gray-50 p-3 rounded-xl border border-gray-100">
        <div>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Informasi Karyawan</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">{slip.nama}</p>
          <p className="text-xs text-gray-600 font-mono">{slip.idKaryawan} • {slip.jabatan}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Transfer Tujuan</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">{slip.namaBank || "CASH"}</p>
          <p className="text-xs text-gray-600 font-mono">{slip.noRekening || "-"}</p>
        </div>
      </div>

      {/* Rincian Finansial Dinamis */}
      <div className="grid grid-cols-2 gap-6 mb-5">
        <div>
          <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest border-b border-gray-200 pb-1.5 mb-2">Pendapatan (Earnings)</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Gaji Pokok</span>
              <span className="font-bold text-gray-800">{formatRupiah(slip.gajiPokok)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tunj. Hadir ({slip.totalHadir} Hari)</span>
              <span className="font-bold text-gray-800">{formatRupiah(slip.tunjanganKehadiran)}</span>
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
      <div className="bg-[#2b5cd5] text-white p-4 rounded-xl flex justify-between items-center shadow-md mb-5">
        <div>
          <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Take Home Pay</p>
          <p className="text-[9px] text-blue-300 mt-0.5">Total bersih ditransfer ke rekening di atas.</p>
        </div>
        <p className="text-xl font-black">{formatRupiah(slip.gajiBersih)}</p>
      </div>

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
          <p className="text-[10px] font-black text-gray-700 tracking-widest uppercase">Invisual Studio</p>
          <p className="text-[9px] text-gray-500 mt-1 font-medium leading-relaxed">Jl. Golf Bar. XVII No.8, Sukamiskin, Kec. Arcamanik, Kota Bandung, Jawa Barat 40293</p>
          <p className="text-[9px] text-gray-400 mt-0.5 font-mono">📞 0822-9555-5314</p>
        </div>
      </div>

    </div>
  );
}
