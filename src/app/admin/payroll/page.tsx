// src/app/admin/payroll/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { excludeOwners } from "@/lib/owners";
import { useToast } from "@/components/Toast";

export default function AdminPayrollPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State untuk Slip & Modal Edit
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // State Form Edit Finansial
  const [financeForm, setFinanceForm] = useState({
    gajiPokok: "",
    bonus: "",
    potongan: ""
  });

  const currentMonthName = new Date().toLocaleDateString("id-ID", { month: 'long', year: 'numeric' });
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    fetchPayrollData();
  }, []);

  const fetchPayrollData = async () => {
    setIsLoading(true);
    try {
      const { data: empData } = await supabase
        .from("employees")
        .select("*")
        .eq("isAktif", true)
        .order("nama", { ascending: true });
      
      const { data: attData } = await supabase
        .from("attendance")
        .select("*")
        .like("tanggal", `${currentMonthPrefix}%`);

      setEmployees(excludeOwners(empData)); // Owner tidak ikut payroll
      setAttendances(attData || []);
    } catch (error) {
      console.error("Gagal menarik data payroll:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePayroll = (emp: any) => {
    const empAbsen = attendances.filter(a => a.idKaryawan === emp.idKaryawan);
    
    const hariHadir = empAbsen.filter(a => a.status === "Tepat Waktu").length;
    const hariTerlambat = empAbsen.filter(a => a.status === "Terlambat").length;
    
    const totalHadir = hariHadir + hariTerlambat;

    const gajiPokokRaw = emp.gajipokok !== undefined ? emp.gajipokok : (emp.gajipoko !== undefined ? emp.gajipoko : emp.gajiPokok);
    
    const gajiPokok = gajiPokokRaw ? Number(gajiPokokRaw) : 0;
    const bonusManual = emp.bonus ? Number(emp.bonus) : 0;
    const potonganManual = emp.potongan ? Number(emp.potongan) : 0;

    const tunjanganKehadiran = totalHadir * 50000;
    const dendaTerlambat = 0; 
    
    const totalPendapatan = gajiPokok + tunjanganKehadiran + bonusManual;
    const totalPotongan = dendaTerlambat + potonganManual; 
    const gajiBersih = totalPendapatan - totalPotongan;

    return {
      ...emp,
      hariHadir,
      hariTerlambat,
      totalHadir,
      gajiPokok,
      bonusManual,
      potonganManual,
      tunjanganKehadiran,
      dendaTerlambat,
      totalPendapatan,
      totalPotongan,
      gajiBersih
    };
  };

  const payrollData = employees.map(calculatePayroll);

  const handleOpenEdit = (emp: any) => {
    setEditingEmp(emp);
    setFinanceForm({
      gajiPokok: emp.gajiPokok > 0 ? emp.gajiPokok.toString() : "",
      bonus: emp.bonusManual > 0 ? emp.bonusManual.toString() : "",
      potongan: emp.potonganManual > 0 ? emp.potonganManual.toString() : ""
    });
  };

  const handleSaveFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const payload: any = {
        bonus: financeForm.bonus === "" ? 0 : Number(financeForm.bonus),
        potongan: financeForm.potongan === "" ? 0 : Number(financeForm.potongan)
      };

      const finalGajiPokok = financeForm.gajiPokok === "" ? 0 : Number(financeForm.gajiPokok);

      if ("gajipokok" in editingEmp) payload.gajipokok = finalGajiPokok;
      else if ("gajipoko" in editingEmp) payload.gajipoko = finalGajiPokok;
      else payload.gajiPokok = finalGajiPokok;

      const { error } = await supabase
        .from("employees")
        .update(payload)
        .eq("idKaryawan", editingEmp.idKaryawan)
        .select();

      if (error) throw error;
      
      toast.sukses(`Komponen gaji ${editingEmp.nama} diperbarui`);
      setEditingEmp(null);
      fetchPayrollData(); 
    } catch (err: any) {
      const detailErr = err.message || JSON.stringify(err);
      toast.gagal("Gagal menyimpan ke database: " + detailErr);
    } finally {
      setIsSaving(false);
    }
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka);
  };

  // =========================================================================
  // EFEK TRANSISI HALAMAN MENGGUNAKAN LOGO BERPUTAR LENGKAP (Layar Penuh)
  // =========================================================================
  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[75vh] animate-in fade-in zoom-in-95 duration-500">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-primer-terang/20 rounded-full blur-2xl animate-pulse"></div>
          <img 
            src="/logo.png" 
            alt="Mengkalkulasi Payroll..." 
            className="relative w-16 h-16 animate-spin object-contain" 
            style={{ animationDuration: "3s" }} 
          />
        </div>
        <p className="text-gray-500 text-[10px] md:text-xs font-mono tracking-[0.25em] uppercase mt-8 animate-pulse">
          Mengkalkulasi Data Keuangan...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-10 font-sans text-gray-300 animate-in fade-in duration-500">
      
      {/* HEADER PAYROLL */}
      <div className="p-6 shadow-lg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden print:hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-white tracking-tight">Kalkulator Payroll Interaktif</h1>
          <p className="text-sm text-gray-400 mt-1">Sesuaikan Gaji Pokok, input Tunjangan Bonus, Kasbon, dan cetak slip secara dinamis.</p>
        </div>
        <div className="relative z-10 bg-kartu-hover border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold text-tint">
          Periode: {currentMonthName}
        </div>
      </div>

      {/* TABEL REKAP PAYROLL */}
      <div className="p-6 overflow-hidden print:hidden relative rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
        {payrollData.length === 0 ? (
          <div className="text-center py-20 text-gray-500">Belum ada data karyawan aktif.</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm text-gray-300 min-w-[1100px] tabel-baris-rapi">
              <thead className="bg-kartu-hover text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 rounded-tl-xl font-semibold">Karyawan</th>
                  <th className="px-4 py-4 font-semibold text-center">Kehadiran</th>
                  <th className="px-4 py-4 font-semibold text-right">Gaji Pokok</th>
                  <th className="px-4 py-4 font-semibold text-right text-green-400">Bonus Variabel</th>
                  <th className="px-4 py-4 font-semibold text-right text-red-400">Total Potongan</th>
                  <th className="px-4 py-4 font-semibold text-right text-green-400">Take Home Pay</th>
                  <th className="px-4 py-4 rounded-tr-xl font-semibold text-center">Aksi Manajemen</th>
                </tr>
              </thead>
              <tbody>
                {payrollData.map((emp, index) => (
                  <tr key={emp.idKaryawan || `emp-${index}`} className="">
                    <td className="px-4 py-4">
                      <p className="font-bold text-white">{emp.nama}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{emp.idKaryawan} • {emp.jabatan}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="bg-green-500/10 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded" title="Total Hari Masuk">{emp.totalHadir} Masuk</span>
                        {emp.hariTerlambat > 0 && (
                          <span className="bg-yellow-500/10 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded">({emp.hariTerlambat} Telat)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium">{formatRupiah(emp.gajiPokok)}</td>
                    <td className="px-4 py-4 text-right font-medium text-green-400">
                      {emp.bonusManual > 0 ? formatRupiah(emp.bonusManual) : "-"}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-red-400">
                      {emp.totalPotongan > 0 ? `-${formatRupiah(emp.totalPotongan)}` : "-"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="bg-green-500/10 text-green-400 font-black px-2.5 py-1.5 rounded-lg border border-green-500/20">
                        {formatRupiah(emp.gajiBersih)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button 
                          onClick={() => handleOpenEdit(emp)}
                          className="bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold transition-colors"
                        >
                          ⚙️ Input Gaji
                        </button>
                        <button 
                          onClick={() => setSelectedSlip(emp)}
                          className="bg-primer-terang hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md"
                        >
                          Lihat Slip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: EDIT INPUT KOMPONEN GAJI */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/5 bg-kartu-hover flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Sesuaikan Gaji Staf</h2>
                <p className="text-xs text-gray-400 mt-0.5">Mengubah data finansial untuk <span className="text-tint font-bold">{editingEmp.nama}</span></p>
              </div>
              <button onClick={() => setEditingEmp(null)} className="text-gray-500 hover:text-white p-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveFinance} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Gaji Pokok Utama (Rp)</label>
                <input type="number" placeholder="0" value={financeForm.gajiPokok} onChange={(e) => setFinanceForm({...financeForm, gajiPokok: e.target.value})} className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primer-terang outline-none placeholder-gray-600" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-green-400 mb-1 uppercase tracking-wider">Bonus / Insentif Tambahan (Rp)</label>
                <input type="number" placeholder="0" value={financeForm.bonus} onChange={(e) => setFinanceForm({...financeForm, bonus: e.target.value})} className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500 outline-none placeholder-gray-600" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-red-400 mb-1 uppercase tracking-wider">Potongan Manual / Kasbon (Rp)</label>
                <input type="number" placeholder="0" value={financeForm.potongan} onChange={(e) => setFinanceForm({...financeForm, potongan: e.target.value})} className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-500 outline-none placeholder-gray-600" />
              </div>

              <div className="pt-4 flex gap-3 border-t border-white/5 mt-2">
                <button type="button" onClick={() => setEditingEmp(null)} className="w-1/3 py-2.5 text-xs font-bold text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className="w-2/3 flex justify-center items-center gap-2 py-2.5 text-xs font-bold text-white bg-green-600 hover:bg-green-500 rounded-xl shadow-lg transition-colors">
                  {/* Animasi logo dipelankan 3s pada tombol simpan (jika sedang saving) */}
                  {isSaving && <img src="/logo.png" className="w-4 h-4 animate-spin object-contain" style={{ animationDuration: "3s" }} alt="Loading..." />}
                  {isSaving ? "Menyimpan..." : "💾 Simpan ke Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SLIP GAJI DIGITAL (PERBAIKAN TINGGI & FOOTER RATA KIRI) */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:bg-white print:p-0">
          {/* max-h-[90vh] dan overflow-y-auto memastikan konten tidak menutupi tombol eksekusi di bawah */}
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden print:max-w-full print:rounded-none print:max-h-full print:overflow-visible relative print:shadow-none">
            
            {/* AREA SCROLL SLIP GAJI */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-black print:overflow-visible print:p-8" id="printable-slip">
              
              {/* KOP SURAT */}
              <div className="flex justify-between items-center border-b-2 border-black/10 pb-4 mb-4">
                <div>
                  <img src="/invisual-light.svg" alt="Invisual Studio" className="h-7 object-contain mb-1 brightness-0" />
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">HR & Payroll Department</p>
                  <p className="text-[10px] text-gray-400 font-medium">Periode: {currentMonthName}</p>
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-black text-primer-terang uppercase tracking-widest">Payslip</h1>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">DOC-{selectedSlip.idKaryawan}</p>
                </div>
              </div>

              {/* Info Karyawan */}
              <div className="grid grid-cols-2 gap-4 mb-5 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Informasi Karyawan</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{selectedSlip.nama}</p>
                  <p className="text-xs text-gray-600 font-mono">{selectedSlip.idKaryawan} • {selectedSlip.jabatan}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Transfer Tujuan</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{selectedSlip.namaBank || "CASH"}</p>
                  <p className="text-xs text-gray-600 font-mono">{selectedSlip.noRekening || "-"}</p>
                </div>
              </div>

              {/* Rincian Finansial Dinamis */}
              <div className="grid grid-cols-2 gap-6 mb-5">
                <div>
                  <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest border-b border-gray-200 pb-1.5 mb-2">Pendapatan (Earnings)</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Gaji Pokok</span>
                      <span className="font-bold text-gray-800">{formatRupiah(selectedSlip.gajiPokok)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tunj. Hadir ({selectedSlip.totalHadir} Hari)</span>
                      <span className="font-bold text-gray-800">{formatRupiah(selectedSlip.tunjanganKehadiran)}</span>
                    </div>
                    {selectedSlip.bonusManual > 0 && (
                      <div className="flex justify-between text-green-600 font-semibold">
                        <span>Bonus Tambahan</span>
                        <span>{formatRupiah(selectedSlip.bonusManual)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-xs font-bold mt-3 pt-2 border-t border-gray-200">
                    <span className="text-gray-800">Total Pendapatan</span>
                    <span className="text-green-600">{formatRupiah(selectedSlip.totalPendapatan)}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest border-b border-gray-200 pb-1.5 mb-2">Potongan (Deductions)</h3>
                  <div className="space-y-2 text-xs">
                    {selectedSlip.potonganManual > 0 ? (
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Kasbon / Potongan Ekstra</span>
                        <span>-{formatRupiah(selectedSlip.potonganManual)}</span>
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
                    <span className="text-red-600">-{formatRupiah(selectedSlip.totalPotongan)}</span>
                  </div>
                </div>
              </div>

              {/* THP */}
              <div className="bg-primer-terang text-white p-4 rounded-xl flex justify-between items-center shadow-md mb-5">
                <div>
                  <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Take Home Pay</p>
                  <p className="text-[9px] text-blue-300 mt-0.5">Total bersih ditransfer ke rekening di atas.</p>
                </div>
                <p className="text-xl font-black">{formatRupiah(selectedSlip.gajiBersih)}</p>
              </div>

              {/* AREA FOOTER (TANDA TANGAN & ALAMAT RATA KIRI) */}
              <div>
                <div className="pt-2 flex justify-between text-center text-xs mb-6">
                  <div>
                    <p className="text-gray-500 mb-6">Diterima Oleh,</p>
                    <p className="font-bold text-gray-800 underline underline-offset-4">{selectedSlip.nama}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-6">Disetujui Oleh,</p>
                    <p className="font-bold text-gray-800 underline underline-offset-4">HR Manager</p>
                  </div>
                </div>
                
                {/* UPDATE: INFO PERUSAHAAN DIUBAH MENJADI RATA KIRI MURNI (text-left) */}
                <div className="pt-4 border-t border-gray-200 text-left">
                  <p className="text-[10px] font-black text-gray-700 tracking-widest uppercase">Invisual Studio</p>
                  <p className="text-[9px] text-gray-500 mt-1 font-medium leading-relaxed">Jl. Golf Bar. XVII No.8, Sukamiskin, Kec. Arcamanik, Kota Bandung, Jawa Barat 40293</p>
                  <p className="text-[9px] text-gray-400 mt-0.5 font-mono">📞 0822-9555-5314</p>
                </div>
              </div>
              
            </div>

            {/* AREA STICKY TOMBOL AKSI (Aman, paten & tidak akan tertutup lagi) */}
            <div className="p-4 bg-gray-50 flex justify-end gap-3 print:hidden border-t border-gray-200 bg-gray-100 shrink-0">
              <button onClick={() => setSelectedSlip(null)} className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Tutup</button>
              <button onClick={() => window.print()} className="px-5 py-2 text-sm font-bold text-white bg-primer-terang hover:bg-blue-600 rounded-lg flex items-center gap-2 shadow-md transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.724.092m6.524-4.659A15.455 15.455 0 0112.532 2.25H8.25m4.282 7.02v.002m0 0H21m-2.81 8.51c-.145.52-.36 1.018-.632 1.487M12 21.75c-2.676 0-5.216-.584-7.499-1.632M15.75 21.75c2.676 0 5.216-.584 7.499-1.632M4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75z" /></svg>
                Print / Simpan PDF
              </button>
            </div>

          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
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
        }
      `}} />
    </div>
  );
}