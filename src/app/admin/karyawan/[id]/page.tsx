// src/app/admin/karyawan/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import LoadingLogo from "@/components/LoadingLogo";
import { useParams, useRouter } from "next/navigation";
import { Employee } from "@/lib/types";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { teksTanggal } from "@/lib/tanggalTampil";
import SlipModal from "@/components/payroll/SlipModal";
import { formatRupiah, gajiPokokMaster, keSlipTampil, namaBerkasSlip } from "@/lib/payroll/hitung";
import { unduhSlipPdf } from "@/lib/payroll/slipPdf";
import { muatRiwayatSlipSaya, type RiwayatSlip } from "@/lib/payroll/klien";

const jamPendekSlip = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

// "2 thn 3 bln" dari tanggal bergabung (ISO); kosong bila tanggal tidak valid.
function masaKerjaDari(iso?: string | null): string {
  if (!iso) return "";
  const mulai = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(mulai.getTime())) return "";
  const kini = new Date();
  let th = kini.getFullYear() - mulai.getFullYear();
  let bl = kini.getMonth() - mulai.getMonth();
  if (kini.getDate() < mulai.getDate()) bl--;
  if (bl < 0) { th--; bl += 12; }
  if (th < 0) return "";
  if (th === 0 && bl === 0) return "Kurang dari 1 bulan";
  return `${th > 0 ? `${th} thn` : ""}${th > 0 && bl > 0 ? " " : ""}${bl > 0 ? `${bl} bln` : ""}`;
}

export default function DetailKaryawanPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const idKaryawan = params.id as string;
  
  const [employee, setEmployee] = useState<any | null>(null);
  const [activeSidebar, setActiveSidebar] = useState("Personal");

  const [isEditRekeningOpen, setIsEditRekeningOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("Scan KTP Asli");
  const [docFileName, setDocFileName] = useState("");

  // Tab Payroll: riwayat slip resmi (payroll_slip) — dimuat saat tab dibuka pertama kali.
  // null = belum dimuat. HR melihat draf & final (draf diberi lencana).
  // Diikat ke idKaryawan agar riwayat karyawan sebelumnya tidak tampil saat berpindah ke karyawan lain.
  const [riwayatMuat, setRiwayatMuat] = useState<{ id: string; daftar: RiwayatSlip[]; pesan: string } | null>(null);
  const [slipDibuka, setSlipDibuka] = useState<RiwayatSlip | null>(null);
  const riwayatSlip = riwayatMuat && riwayatMuat.id === idKaryawan ? riwayatMuat.daftar : null;
  const riwayatPesan = riwayatMuat && riwayatMuat.id === idKaryawan ? riwayatMuat.pesan : "";

  const muatRiwayatSlip = async () => {
    const id = idKaryawan;
    const r = await muatRiwayatSlipSaya(supabase, id);
    setRiwayatMuat(r.ok ? { id, daftar: r.riwayat, pesan: "" } : { id, daftar: [], pesan: r.pesan });
  };

  const bukaSidebar = (menu: string) => {
    setActiveSidebar(menu);
    if (menu === "Payroll" && riwayatSlip === null) muatRiwayatSlip();
  };

  const fetchEmployeeDetail = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("idKaryawan", idKaryawan)
        .single(); 

      if (error) throw error;

      if (data) {
        if (!data.dokumen) data.dokumen = [];
        setEmployee(data);
        setBankName(data.namaBank || "Bank BCA");
        setAccountNumber(data.noRekening || "");
      }
    } catch (err: any) {
      toast.gagal("Gagal memuat detail karyawan: " + err.message);
    }
  };

  useEffect(() => {
    fetchEmployeeDetail();
  }, [idKaryawan]);

  const handleSaveRekening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    try {
      const { error } = await supabase
        .from("employees")
        .update({
          namaBank: bankName,
          noRekening: accountNumber
        })
        .eq("idKaryawan", idKaryawan);

      if (error) throw error;

      toast.sukses("Data rekening bank diperbarui");
      setIsEditRekeningOpen(false);
      await fetchEmployeeDetail(); 
    } catch (err: any) {
      toast.gagal("Gaji gagal diperbarui: " + err.message);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !docFileName) return;

    const newDocument = {
      id: Date.now().toString(),
      judul: docTitle,
      namaFile: docFileName,
      tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      ukuran: (Math.random() * (2.5 - 0.1) + 0.1).toFixed(1) + " MB"
    };

    const updatedDokumen = [...(employee.dokumen || []), newDocument];

    try {
      const { error } = await supabase
        .from("employees")
        .update({ dokumen: updatedDokumen })
        .eq("idKaryawan", idKaryawan);

      if (error) throw error;

      toast.sukses(`Dokumen "${docTitle}" tersimpan`);
      setIsUploadModalOpen(false);
      setDocFileName("");
      await fetchEmployeeDetail(); 
    } catch (err: any) {
      toast.gagal("Gagal mengarsipkan dokumen: " + err.message);
    }
  };

  const handleDeleteDocument = async (idDokumen: string, judul: string) => {
    if (!(await toast.konfirmasi(`Hapus dokumen "${judul}" secara permanen?`, { labelYa: "Hapus" }))) return;

    const updatedDokumen = employee.dokumen.filter((doc: any) => doc.id !== idDokumen);

    try {
      const { error } = await supabase
        .from("employees")
        .update({ dokumen: updatedDokumen })
        .eq("idKaryawan", idKaryawan);

      if (error) throw error;

      await fetchEmployeeDetail();
    } catch (err: any) {
      toast.gagal("Gagal menghapus dokumen: " + err.message);
    }
  };

  if (!employee) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <LoadingLogo size={64} withRing text="Memuat profil" />
      </div>
    );
  }

  const InfoRow = ({ label, value, isMono = false }: { label: string, value: string | number, isMono?: boolean }) => {
    const kosong = value === undefined || value === null || value === "" || value === "-";
    return (
      <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
        <span className="text-xs font-semibold text-gray-500">{label}</span>
        {kosong
          ? <span className="text-sm italic text-gray-600">Belum diisi</span>
          : <span className={`text-sm font-bold text-white ${isMono ? 'font-mono tracking-wide' : ''}`}>{value}</span>}
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] w-full flex flex-col gap-6 pb-10 font-sans">
      
      <div className="flex justify-between items-center p-4 shadow-lg relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin/karyawan')} aria-label="Kembali ke daftar karyawan" title="Kembali" className="sentuh p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-white">{employee.nama}</h1>
        </div>
        {/* Tombol "Ekspor Detail" lama tidak berfungsi — diganti tautan ubah data (membuka form edit di halaman Karyawan) */}
        <button onClick={() => router.push(`/admin/karyawan?edit=${employee.idKaryawan}`)} className="border border-white/10 hover:bg-white/5 text-gray-300 px-4 py-2 rounded-lg text-xs md:text-sm transition-colors flex items-center gap-2 font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89.112l-2.848.316.316-2.848a4.5 4.5 0 011.112-1.89l12.48-12.48zM16.862 4.487L19.5 7.125" /></svg>
          Ubah data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="p-6 flex flex-col items-center text-center relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primer-terang/10 rounded-full blur-3xl"></div>
            <div className="w-24 h-24 rounded-full bg-primer-terang text-white flex items-center justify-center text-3xl font-black shadow-[0_0_20px_rgba(43,92,213,0.4)] mb-4 border-2 border-white/10 relative z-10">
              {employee.nama ? employee.nama.split(' ').map((n:any) => n[0]).join('').substring(0, 2).toUpperCase() : "NN"}
            </div>
            <h2 className="text-lg font-bold text-white relative z-10">{employee.nama}</h2>
            <p className="text-xs text-gray-400 relative z-10">{employee.jabatan}</p>
            <span className={`mt-3 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider relative z-10 ${/PKWT|Kontrak|Internship|Probation/i.test(String(employee.statusKaryawan || employee.status || "")) ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
              {employee.statusKaryawan || employee.status || "Status belum diisi"}
            </span>
          </div>

          <div className="p-4 flex flex-col gap-1 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
            {["Personal", "Kepegawaian", "Kehadiran", "Keuangan", "Karir", "Payroll", "Dokumen"].map((menu) => (
              <button 
                key={menu} 
                onClick={() => bukaSidebar(menu)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-3 ${activeSidebar === menu ? "bg-primer-terang/10 text-tint border border-primer-terang/20" : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"}`}
              >
                {menu === "Personal" && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
                {menu === "Kepegawaian" && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>}
                {menu === "Kehadiran" && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                {menu === "Keuangan" && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                {menu === "Karir" && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
                {menu === "Payroll" && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>}
                {menu === "Dokumen" && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
                {menu}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {activeSidebar === "Personal" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
              <div className="p-6 md:p-8 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-white/5 pb-4">Data Pribadi</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <InfoRow label="ID Karyawan" value={employee.idKaryawan} isMono />
                  <InfoRow label="Jenis Kelamin" value={employee.jenisKelamin} />
                  <InfoRow label="Kewarganegaraan" value={employee.kewarganegaraan} />
                  <InfoRow label="NIK (KTP)" value={employee.nikKtp} isMono />
                  <InfoRow label="Tanggal Lahir" value={employee.tanggalLahir ? teksTanggal(employee.tanggalLahir, { hari: false }) : ""} />
                  <InfoRow label="Status Perkawinan" value={employee.statusPerkawinan} />
                  <InfoRow label="Agama" value={employee.agama} />
                  <InfoRow label="Golongan Darah" value={employee.golonganDarah} />
                </div>
              </div>
              <div className="p-6 md:p-8 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-white/5 pb-4">Data Kontak</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <InfoRow label="Nomor Ponsel (WhatsApp)" value={employee.noPonsel} isMono />
                  <InfoRow label="Email" value={employee.email} />
                  <div className="md:col-span-2"><InfoRow label="Alamat Domisili" value={employee.alamatDomisili} /></div>
                  <div className="md:col-span-2"><InfoRow label="Kontak Darurat" value={employee.kontakDarurat} /></div>
                </div>
              </div>
            </div>
          )}

          {activeSidebar === "Kepegawaian" && (
            <div className="p-6 md:p-8 animate-in fade-in duration-300 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <h3 className="text-lg font-bold text-white mb-6 border-b border-white/5 pb-4">Informasi Kepegawaian</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <InfoRow label="Tanggal Bergabung" value={employee.tanggalBergabung ? teksTanggal(employee.tanggalBergabung) : ""} />
                <InfoRow label="Masa Kerja" value={employee.masaKerja || masaKerjaDari(employee.tanggalBergabung)} />
                <InfoRow label="Organisasi / Divisi" value={employee.organisasi} />
                <InfoRow label="Jabatan" value={employee.jabatan} />
                <InfoRow label="Status Karyawan" value={employee.status} />
                <InfoRow label="Lokasi Kantor" value={employee.lokasiKantor} />
                <InfoRow label="Jadwal Kerja" value={employee.jadwal || (employee.jamMasuk && employee.jamKeluar ? `${employee.jamMasuk} – ${employee.jamKeluar}` : "")} />
                <InfoRow label="Pangkat / Golongan" value={employee.pangkat} />
                <InfoRow label="Hak Akses Sistem" value={employee.peran} />
              </div>
            </div>
          )}

          {activeSidebar === "Kehadiran" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-5 shadow-lg border-l-4 border-l-green-500 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                  <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">Total Hadir</p>
                  <p className="text-2xl font-black text-white">22 <span className="text-sm font-normal text-gray-400">Hari</span></p>
                </div>
                <div className="p-5 shadow-lg border-l-4 border-l-yellow-500 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                  <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">Terlambat</p>
                  <p className="text-2xl font-black text-white">1 <span className="text-sm font-normal text-gray-400">Hari</span></p>
                </div>
                <div className="p-5 shadow-lg border-l-4 border-l-purple-500 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                  <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">Cuti Terpakai</p>
                  <p className="text-2xl font-black text-white">{12 - (employee.sisaCuti !== undefined ? employee.sisaCuti : 12)} <span className="text-sm font-normal text-gray-400">Hari</span></p>
                </div>
                <div className="bg-primer-terang/10 border border-primer-terang/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-primer-terang/20 rounded-full blur-xl"></div>
                  <p className="text-xs text-tint font-bold mb-1 uppercase tracking-wide">Sisa Saldo Cuti</p>
                  <p className="text-2xl font-black text-white tabular-nums relative z-10">{employee.sisaCuti !== undefined ? employee.sisaCuti : 12} <span className="text-sm font-normal text-gray-400">Hari</span></p>
                </div>
              </div>
              
              <div className="p-6 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-lg font-bold text-white">Riwayat Absensi Bulan Ini</h3>
                  <button className="text-xs font-bold bg-primer-terang hover:bg-blue-600 px-4 py-2 rounded-lg text-white transition-colors shadow-lg">Unduh Log PDF</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-kartu-hover text-gray-400 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-4 rounded-tl-lg font-semibold">Tanggal</th>
                        <th className="px-4 py-4 font-semibold text-center">Clock In</th>
                        <th className="px-4 py-4 font-semibold text-center">Clock Out</th>
                        <th className="px-4 py-4 rounded-tr-lg font-semibold">Status Harian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-4 font-medium text-white">Hari ini, 23 Juni 2026</td>
                        <td className="px-4 py-4 font-mono text-green-400 text-center">08:45 WIB</td>
                        <td className="px-4 py-4 font-mono text-gray-500 text-center">-</td>
                        <td className="px-4 py-4"><span className="bg-green-500/10 text-green-400 text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-full border border-green-500/20 block w-max">On Duty</span></td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-4 font-medium text-white">Kemarin, 22 Juni 2026</td>
                        <td className="px-4 py-4 font-mono text-yellow-400 text-center">09:15 WIB</td>
                        <td className="px-4 py-4 font-mono text-white text-center">18:05 WIB</td>
                        <td className="px-4 py-4"><span className="bg-yellow-500/10 text-yellow-400 text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-full border border-yellow-500/20 block w-max">Terlambat</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSidebar === "Keuangan" && (
            <div className="p-6 md:p-8 animate-in fade-in slide-in-from-right-4 duration-300 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primer-terang/10 rounded-full blur-3xl"></div>
              
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4 relative z-10">
                <h3 className="text-lg font-bold text-white">Informasi Rekening Bank</h3>
                <button onClick={() => setIsEditRekeningOpen(true)} className="text-xs bg-primer-terang hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-bold transition-colors shadow-[0_0_15px_rgba(43,92,213,0.3)]">Edit Rekening</button>
              </div>
              
              <div className="flex items-center gap-6 p-6 border border-white/10 rounded-2xl bg-gradient-to-br from-input to-kartu relative z-10">
                <div className="w-16 h-16 rounded-xl bg-primer-terang/10 flex items-center justify-center border border-primer-terang/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-tint"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5c.621 0 1.125.504 1.125 1.125v12.375c0 .621-.504 1.125-1.125 1.125H3.75a1.125 1.125 0 01-1.125-1.125V5.625C2.625 5.004 3.129 4.5 3.75 4.5z" /></svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-bold mb-1 uppercase tracking-wider">{employee.namaBank || "Belum diatur"}</p>
                  <p className="text-2xl font-mono text-white tracking-[0.2em] mb-1">{employee.noRekening || "0000000000"}</p>
                  <p className="text-xs text-gray-500 uppercase">A.N. {employee.nama}</p>
                </div>
              </div>
            </div>
          )}

          {activeSidebar === "Karir" && (
            <div className="p-6 md:p-8 animate-in fade-in slide-in-from-right-4 duration-300 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <h3 className="text-lg font-bold text-white mb-6 border-b border-white/5 pb-4">Riwayat Karir & Kontrak</h3>
              <div className="relative border-l border-white/10 ml-3 md:ml-4 space-y-8 pb-4">
                <div className="relative pl-6">
                  <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 bg-primer-terang rounded-full ring-4 ring-kartu"></div>
                  <h4 className="text-white font-bold text-sm">Posisi Saat Ini</h4>
                  <p className="text-lg text-tint font-bold mt-1">{employee.jabatan}</p>
                  <p className="text-xs text-gray-400 mt-1">{teksTanggal(employee.tanggalBergabung)} – Sekarang</p>
                  <span className={`inline-block mt-2 px-2 py-1 rounded text-[11px] font-bold tracking-wider ${/PKWT|Kontrak|Internship|Probation/i.test(String(employee.statusKaryawan || employee.status || "")) ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                    {employee.statusKaryawan || employee.status || "Status belum diisi"}
                  </span>
                </div>
                <div className="relative pl-6">
                  <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 bg-gray-600 rounded-full ring-4 ring-kartu"></div>
                  <h4 className="text-gray-400 font-bold text-sm">Bergabung dengan Invisual Studio</h4>
                  <p className="text-xs text-gray-500 mt-1">Sistem mencatat tanggal orientasi pertama karyawan pada {teksTanggal(employee.tanggalBergabung)}.</p>
                </div>
              </div>
            </div>
          )}

          {activeSidebar === "Payroll" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300" data-tab-payroll>
              <div className="border border-primer-terang/20 p-6 md:p-8 shadow-[0_10px_30px_rgba(43,92,213,0.05)] relative overflow-hidden rounded-xl border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primer-terang/5 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4 relative z-10">
                  <h3 className="text-lg font-bold text-white">Kompensasi</h3>
                  <Link href="/admin/payroll" className="text-xs bg-primer-terang hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-bold transition-colors">Buka Payroll</Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 relative z-10">
                  <InfoRow label="Gaji Pokok (tetap)" value={formatRupiah(gajiPokokMaster(employee))} isMono />
                  <InfoRow label="Bank" value={employee.namaBank || "-"} />
                  <InfoRow label="No. Rekening" value={employee.noRekening || "-"} isMono />
                </div>
                <p className="text-[11px] text-gray-500 mt-4 relative z-10">Bonus, potongan, dan catatan diisi per periode di halaman Payroll (Input Gaji). Gaji pokok tetap diperbarui dari sana dengan centang &quot;simpan sebagai gaji pokok tetap&quot;.</p>
              </div>

              <div className="p-6 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                <h3 className="text-sm font-bold text-white mb-4">Riwayat Slip Gaji</h3>
                <div className="flex flex-col gap-3" data-riwayat-slip>
                  {riwayatSlip === null ? (
                    <p className="text-xs text-gray-500 animate-pulse">Memuat riwayat slip…</p>
                  ) : riwayatSlip.length === 0 ? (
                    <p className="text-xs text-gray-500">{riwayatPesan || "Belum ada slip gaji untuk karyawan ini."}</p>
                  ) : riwayatSlip.map((r) => {
                    const t = keSlipTampil(r);
                    const draf = r.periode.status !== "final";
                    return (
                      <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-white/10 rounded-xl hover:bg-white/5 transition-colors" data-slip-periode={r.periode.label}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${draf ? "bg-amber-500/10 text-amber-300" : "bg-green-500/10 text-green-400"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm flex items-center gap-2">
                              Slip Gaji — {r.periode.label}
                              {draf && <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">Draf</span>}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              THP <span className="text-green-400 font-bold">{formatRupiah(t.gajiBersih)}</span>
                              {" · "}
                              {r.email_status === "terkirim" ? `dikirim ${jamPendekSlip(r.email_dikirim_pada)}` : r.email_status === "gagal" ? <span className="text-red-400" title={r.email_galat || ""}>email gagal</span> : r.email_status === "simulasi" ? "email (simulasi)" : "belum dikirim ke email"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => setSlipDibuka(r)} className="bg-primer-terang hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors" data-aksi="lihat">Lihat</button>
                          <button type="button" onClick={() => unduhSlipPdf(t, r.periode.label, namaBerkasSlip(r.periode.label, t.nama), { draf })} className="bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold transition-colors" data-aksi="unduh">Unduh PDF</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {slipDibuka && (
                <SlipModal slip={keSlipTampil(slipDibuka)} label={slipDibuka.periode.label} draf={slipDibuka.periode.status !== "final"} onTutup={() => setSlipDibuka(null)} />
              )}
            </div>
          )}

          {activeSidebar === "Dokumen" && (
            <div className="p-6 md:p-8 animate-in fade-in slide-in-from-right-4 duration-300 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Brankas Dokumen (E-Filing)</h3>
                  <p className="text-xs text-gray-400 mt-1">Arsip digital KTP, NPWP, dan Kontrak terenkripsi aman di cloud Supabase.</p>
                </div>
                <button onClick={() => setIsUploadModalOpen(true)} className="text-xs bg-primer-terang hover:bg-blue-600 px-4 py-2.5 rounded-lg text-white font-bold transition-colors shadow-[0_0_15px_rgba(43,92,213,0.3)] flex items-center gap-2">
                  Unggah Dokumen
                </button>
              </div>

              {(!employee.dokumen || employee.dokumen.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-dashed relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                  <p className="text-gray-400 font-semibold">Belum ada dokumen yang diarsipkan di server Supabase.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employee.dokumen.map((doc: any) => (
                    <div key={doc.id} className="bg-input border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:border-primer-terang/30 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">DOC</div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{doc.judul}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-gray-500 font-mono truncate max-w-[100px]">{doc.namaFile}</span>
                            <span className="text-[11px] text-gray-600 bg-white/5 px-1.5 rounded">{doc.ukuran}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDeleteDocument(doc.id, doc.judul)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="Hapus Dokumen">
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {isEditRekeningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-1">Perbarui Rekening Bank</h2>
            <form onSubmit={handleSaveRekening} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Nama Bank</label>
                <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full bg-input border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primer-terang outline-none">
                  <option value="Bank BCA">Bank BCA</option>
                  <option value="Bank Mandiri">Bank Mandiri</option>
                  <option value="Bank BNI">Bank BNI</option>
                  <option value="Bank BRI">Bank BRI</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Nomor Rekening</label>
                <input type="text" required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full bg-input border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primer-terang outline-none font-mono" />
              </div>
              
              <div className="pt-4 flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => setIsEditRekeningOpen(false)} className="px-5 py-2 text-sm font-bold text-gray-300 border border-white/10 rounded-lg">Batal</button>
                <button type="submit" className="px-5 py-2 text-sm font-bold text-white bg-primer-terang rounded-lg shadow-lg">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UNGGAH DOKUMEN DIGITAL (DENGAN TOMBOL UPLOAD ASLI) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-1">Unggah Dokumen Baru</h2>
            <form onSubmit={handleUploadDocument} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Jenis Dokumen</label>
                <select value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="w-full bg-input border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primer-terang outline-none">
                  <option value="Scan KTP Asli">Scan KTP Asli</option>
                  <option value="Scan NPWP">Scan NPWP</option>
                  <option value="Kontrak Kerja (PKWT)">Kontrak Kerja (PKWT)</option>
                  <option value="Pakta Integritas / NDA">Pakta Integritas / NDA</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Pilih Berkas (PDF / JPG)</label>
                <div className="relative">
                  {/* Ini adalah tombol upload file aslinya yang tersembunyi namun bisa diklik */}
                  <input 
                    type="file" 
                    required 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setDocFileName(file.name);
                    }} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  
                  {/* Ini adalah desain visualnya */}
                  <div className="w-full bg-input border border-white/10 border-dashed hover:border-primer-terang rounded-lg px-4 py-6 text-center transition-colors relative">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mx-auto text-gray-500 mb-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                    </svg>
                    <span className="text-sm font-bold text-tint">
                      {docFileName ? docFileName : "Klik atau seret berkas ke sini"}
                    </span>
                    {!docFileName && (
                      <p className="text-[11px] text-gray-500 mt-1">Maksimal 5MB. Format didukung: .pdf, .jpg, .png</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="pt-4 flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => {setIsUploadModalOpen(false); setDocFileName("");}} className="px-5 py-2 text-sm font-bold text-gray-300 border border-white/10 rounded-lg">Batal</button>
                <button type="submit" disabled={!docFileName} className="px-5 py-2 text-sm font-bold text-white bg-primer-terang rounded-lg shadow-lg disabled:opacity-50">Simpan Arsip</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}