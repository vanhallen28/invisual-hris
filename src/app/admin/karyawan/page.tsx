// src/app/admin/karyawan/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import PerformancePanel from "@/components/PerformancePanel";
import { logAudit } from "@/lib/audit";

export default function AdminKaryawanPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State untuk Modal Form (Tambah/Edit)
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State Profil Detail
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

  // Pencarian & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("Semua");

  // POPUP TOAST & KONFIRMASI HAPUS CUSTOM
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: "success" | "error" } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; nama: string } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // FITUR NPWP TELAH DIHAPUS DARI STATE
  const [formData, setFormData] = useState({
    idKaryawan: "", nama: "", email: "", noPonsel: "", nikKtp: "",
    alamatDomisili: "", jabatan: "UI/UX Designer", status: "PKWT (Kontrak)",
    tanggalBergabung: "", sisaCuti: 12, gajiPokok: "", namaBank: "", 
    noRekening: "", isAktif: true, role: "member",
    institusiMagang: "", tanggalSelesaiMagang: "",
    boardAccess: [] as string[], contentHub: true,
    jamMasuk: "09:00", jamKeluar: "17:00"
  });
  const [roleMap, setRoleMap] = useState<Record<string, string>>({}); // user_id -> role Tracker
  const [allBoards, setAllBoards] = useState<string[]>([]); // nama board Daily Task untuk pembatasan akses

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("employees").select("*").order("nama", { ascending: true });
      if (error) throw error;
      setEmployees(data || []);
      const { data: mem } = await supabase.from("members").select("id, role");
      if (mem) { const map: Record<string, string> = {}; mem.forEach((m: any) => { map[m.id] = m.role; }); setRoleMap(map); }
      const { data: bnodes } = await supabase.from("tree_nodes").select("name").eq("kind", "board");
      const names = Array.from(new Set((bnodes || []).map((b: any) => String(b.name || "").trim()).filter(Boolean)));
      setAllBoards(names.sort((a, b) => a.localeCompare(b)));
    } catch (error: any) {
      showToast("Gagal mengambil data dari server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeesBackground = async () => {
    try {
      const { data, error } = await supabase.from("employees").select("*").order("nama", { ascending: true });
      if (!error && data) setEmployees(data);
    } catch (error) {}
  };

  useEffect(() => {
    fetchEmployees();

    const channel = supabase
      .channel('realtime-karyawan')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (payload) => {
          fetchEmployeesBackground(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      if (editId) {
        const empToEdit = employees.find(e => e.idKaryawan === editId);
        if (empToEdit) {
          setSearchQuery(empToEdit.nama);
          openEditModal(empToEdit);
          window.history.replaceState(null, '', '/admin/karyawan');
        }
      }
    }
  }, [employees]);

  const calculateMasaKerja = (joinDateString: string) => {
    if (!joinDateString || joinDateString === "") return "Belum ditentukan HRD";
    const joinDate = new Date(joinDateString);
    const now = new Date();
    if (isNaN(joinDate.getTime())) return "Format Tanggal Invalid";

    let years = now.getFullYear() - joinDate.getFullYear();
    let months = now.getMonth() - joinDate.getMonth();
    
    if (months < 0) { years--; months += 12; }
    if (years === 0 && months === 0) return "Pegawai Baru (< 1 Bulan)";
    return `${years > 0 ? years + " Tahun " : ""}${months > 0 ? months + " Bulan" : ""}`.trim();
  };

  const formatRupiah = (angka: number) => {
    if (!angka) return "Rp 0";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData({
      idKaryawan: "", nama: "", email: "", noPonsel: "", nikKtp: "",
      alamatDomisili: "", jabatan: "UI/UX Designer", status: "PKWT (Kontrak)",
      tanggalBergabung: new Date().toISOString().split('T')[0],
      sisaCuti: 12, gajiPokok: "", namaBank: "", noRekening: "", isAktif: true, role: "member",
      institusiMagang: "", tanggalSelesaiMagang: "",
      boardAccess: [] as string[], contentHub: true,
      jamMasuk: "09:00", jamKeluar: "17:00"
    });
    setShowModal(true);
  };

  const openEditModal = (emp: any) => {
    setIsEditMode(true);
    fetch(`/api/employees?idKaryawan=${encodeURIComponent(emp.idKaryawan)}`)
      .then((r) => r.json())
      .then((d) => { if (d && !d.error) setFormData((prev) => ({ ...prev, boardAccess: Array.isArray(d.boardAccess) ? d.boardAccess : [], contentHub: d.contentHub !== false, role: d.role || prev.role })); })
      .catch(() => {});
    setFormData({
      idKaryawan: emp.idKaryawan || "",
      nama: emp.nama || "",
      email: emp.email || "",
      noPonsel: emp.noPonsel || "",
      nikKtp: emp.nikKtp || "",
      alamatDomisili: emp.alamatDomisili || "",
      jabatan: emp.jabatan || emp.departemen || "UI/UX Designer", 
      status: emp.status || "PKWT (Kontrak)",
      tanggalBergabung: emp.tanggalBergabung || "",
      sisaCuti: emp.sisaCuti !== undefined && emp.sisaCuti !== null ? emp.sisaCuti : 12,
      gajiPokok: emp.gajiPokok || emp.gajipokok || "", 
      namaBank: emp.namaBank || "",
      noRekening: emp.noRekening || "",
      isAktif: emp.isAktif ?? true,
      role: (emp.user_id && roleMap[emp.user_id]) || "member",
      institusiMagang: emp.institusiMagang || "",
      tanggalSelesaiMagang: emp.tanggalSelesaiMagang || "",
      boardAccess: [], contentHub: true,
      jamMasuk: emp.jamMasuk || "09:00", jamKeluar: emp.jamKeluar || "17:00"
    });
    setShowModal(true);
  };

  const handleSaveData = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // FITUR NPWP TELAH DIHAPUS DARI PAYLOAD
    const payload = {
      idKaryawan: formData.idKaryawan,
      nama: formData.nama,
      email: formData.email.trim().toLowerCase(),
      noPonsel: formData.noPonsel || null,
      nikKtp: formData.nikKtp ? String(formData.nikKtp) : null, 
      alamatDomisili: formData.alamatDomisili || null,
      jabatan: formData.jabatan || null, 
      status: formData.status,
      tanggalBergabung: formData.tanggalBergabung ? formData.tanggalBergabung : null,
      sisaCuti: Number(formData.sisaCuti),
      gajipokok: formData.gajiPokok ? Number(formData.gajiPokok) : 0,
      namaBank: formData.namaBank || null,
      noRekening: formData.noRekening || null,
      isAktif: formData.isAktif,
      // Khusus magang — dikosongkan otomatis kalau status bukan Internship
      institusiMagang: formData.status === "Internship" ? (formData.institusiMagang || null) : null,
      tanggalSelesaiMagang: formData.status === "Internship" ? (formData.tanggalSelesaiMagang || null) : null,
      jamMasuk: formData.jamMasuk || "09:00",
      jamKeluar: formData.jamKeluar || "17:00"
    };

    try {
      const res = await fetch('/api/employees', {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEditMode
            ? { ...payload, idKaryawan: formData.idKaryawan, role: formData.role, boardAccess: formData.boardAccess, contentHub: formData.contentHub }
            : { ...payload, role: formData.role, boardAccess: formData.boardAccess, contentHub: formData.contentHub }
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan data.');
      setShowModal(false);
      showToast(
        isEditMode
          ? "Data karyawan & role berhasil diperbarui!"
          : "Karyawan baru dibuat — akun login & role Tracker aktif.",
        "success"
      );
      logAudit(isEditMode ? "Ubah Data Karyawan" : "Tambah Karyawan", formData.nama);
      fetchEmployeesBackground();
    } catch (err: any) {
      showToast(`Gagal menyimpan: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id, nama } = deleteConfirm;

    setEmployees(prev => prev.filter(emp => emp.idKaryawan !== id));
    setDeleteConfirm(null);
    showToast(`Menghapus ${nama}…`, "success");

    try {
      const res = await fetch('/api/employees', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idKaryawan: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus.');
      logAudit("Hapus Karyawan", nama);
      showToast(`${nama} dihapus permanen (akun & role Tracker ikut terhapus).`, "success");
    } catch (err: any) {
      showToast(`Gagal menghapus data: ${err.message}`, "error");
      fetchEmployeesBackground();
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchQuery = 
      emp.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.idKaryawan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedStatusFilter === "Semua") return matchQuery;
    return matchQuery && emp.status === selectedStatusFilter;
  });

  // =========================================================================
  // EFEK TRANSISI HALAMAN MENGGUNAKAN LOGO BERPUTAR LENGKAP (Layar Penuh)
  // =========================================================================
  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[75vh] animate-in fade-in zoom-in-95 duration-500">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-[#2b5cd5]/20 rounded-full blur-2xl animate-pulse"></div>
          <img 
            src="/logo.png" 
            alt="Memuat Invisual..." 
            className="relative w-16 h-16 animate-spin object-contain" 
            style={{ animationDuration: "3s" }} 
          />
        </div>
        <p className="text-gray-500 text-[10px] md:text-xs font-mono tracking-[0.25em] uppercase mt-8 animate-pulse">
          Menyinkronkan Database...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-28 md:pb-10 font-sans text-gray-300 animate-in fade-in duration-500 relative">
      
      {/* SISTEM TOAST NOTIFIKASI ELEGAN */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl animate-in slide-in-from-top-10 fade-in duration-300 ${toast.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {toast.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          )}
          <span className="text-sm font-bold tracking-wide">{toast.msg}</span>
        </div>
      )}

      {/* HEADER UTAMA */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Database Karyawan</h1>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></span>
            Terhubung & Sinkronisasi Live dengan Supabase Server
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 relative z-10 w-full lg:w-auto">
          <button onClick={openAddModal} className="w-full lg:w-auto bg-white text-black hover:bg-gray-200 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Tambah Karyawan Baru
          </button>
        </div>
      </div>

      {/* FILTER & PENCARIAN */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:flex-1 relative">
          <input type="text" placeholder="Cari nama atau ID karyawan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors shadow-sm" />
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 absolute left-4 top-3.5 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
        </div>
        <select value={selectedStatusFilter} onChange={(e) => setSelectedStatusFilter(e.target.value)} className="w-full md:w-56 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 shadow-sm">
          <option value="Semua">Semua Status Kontrak</option>
          <option value="PKWT (Kontrak)">PKWT (Kontrak)</option>
          <option value="Tetap">Tetap</option>
          <option value="Tetap Percobaan (Probation)">Tetap Percobaan</option>
          <option value="Internship">Internship (Magang)</option>
        </select>
      </div>

      {/* TABEL DATA KARYAWAN */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 md:p-6 shadow-2xl overflow-hidden">
        {filteredEmployees.length === 0 ? (
           <div className="text-center py-20 text-gray-500">Tidak ada data karyawan yang cocok dengan pencarian Anda.</div>
        ) : (
          <>
          <div className="overflow-x-auto custom-scrollbar hidden md:block">
            <table className="w-full text-left text-sm text-gray-300 min-w-[900px]">
              <thead className="border-b border-white/10 text-gray-500 text-[10px] md:text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-bold">Nama Staf (Klik Profil)</th>
                  <th className="px-6 py-4 font-bold">Kontak Akses</th>
                  <th className="px-6 py-4 font-bold">Departemen & Status</th>
                  <th className="px-6 py-4 font-bold text-center">Sisa Cuti</th>
                  <th className="px-6 py-4 font-bold text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredEmployees.map((emp, index) => (
                  <tr key={emp.idKaryawan || `emp-${index}`} className="hover:bg-[#111111] transition-colors group">
                    
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-base shrink-0 group-hover:bg-white/10 transition-colors">
                          {emp.nama ? emp.nama.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div onClick={() => setSelectedProfile(emp)} className="cursor-pointer group/name">
                          <p className="font-bold text-white text-base leading-tight group-hover/name:text-blue-400 transition-colors flex items-center gap-2">{emp.nama} <span className="text-[10px] opacity-0 group-hover/name:opacity-100 transition-opacity">↗</span></p>
                          <p className="text-xs text-gray-500 font-mono font-medium mt-1">{emp.idKaryawan}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <p className="text-sm text-gray-300 font-medium">{emp.email}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{emp.noPonsel || "-"}</p>
                    </td>

                    <td className="px-6 py-5">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider block w-max mb-1.5
                        ${emp.status === 'Tetap' ? 'bg-green-500/10 text-green-400 border border-green-500/10' : 
                          emp.status === 'PKWT (Kontrak)' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/10' : 
                          emp.status === 'Internship' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 
                          'bg-purple-500/10 text-purple-400 border border-purple-500/10'}`}>
                        {emp.status}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">{emp.jabatan || emp.departemen || "Belum ada jabatan"}</span>
                      {emp.user_id && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider block w-max mt-1.5 ${roleMap[emp.user_id] === 'manager' ? 'bg-[#2b5cd5]/15 text-[#8ba7ff] border border-[#2b5cd5]/25' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                          {roleMap[emp.user_id] === 'manager' ? '★ Manager' : 'Member'}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-5 text-center">
                      <span className="inline-block px-3 py-1.5 bg-[#111111] border border-white/5 text-gray-300 font-mono font-medium rounded-lg">
                        {emp.sisaCuti} Hari
                      </span>
                    </td>

                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(emp)} className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all border border-transparent hover:border-white/10" title="Ubah Data">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89.112l-2.848.316.316-2.848a4.5 4.5 0 011.112-1.89l12.48-12.48zM16.862 4.487L19.5 7.125" /></svg>
                        </button>
                        <button onClick={() => setDeleteConfirm({ show: true, id: emp.idKaryawan, nama: emp.nama })} className="text-gray-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20" title="Hapus Karyawan">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TAMPILAN KARTU — KHUSUS MOBILE */}
          <div className="md:hidden space-y-3">
            {filteredEmployees.map((emp, index) => (
              <div key={emp.idKaryawan || `m-${index}`} className="bg-[#111111] border border-white/10 rounded-2xl p-4 mo-fade-up">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-base shrink-0">
                    {emp.nama ? emp.nama.charAt(0).toUpperCase() : "?"}
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => setSelectedProfile(emp)}>
                    <p className="font-bold text-white text-sm leading-tight truncate">{emp.nama} <span className="text-[10px] text-gray-500">↗</span></p>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">{emp.idKaryawan}</p>
                    <p className="text-[11px] text-gray-400 mt-1 truncate">{emp.email}</p>
                  </div>
                  {emp.user_id && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0 ${roleMap[emp.user_id] === 'manager' ? 'bg-[#124bce]/15 text-[#8ba7ff] border border-[#124bce]/25' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                      {roleMap[emp.user_id] === 'manager' ? '★ Mgr' : 'Member'}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${emp.status === 'Tetap' ? 'bg-green-500/10 text-green-400' : emp.status === 'PKWT (Kontrak)' ? 'bg-yellow-500/10 text-yellow-500' : emp.status === 'Internship' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>{emp.status}</span>
                  <span className="text-[11px] text-gray-400 truncate max-w-[45%]">{emp.jabatan || "—"}</span>
                  <span className="text-[11px] text-gray-500 ml-auto whitespace-nowrap">Cuti: {emp.sisaCuti} hari</span>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                  <button onClick={() => openEditModal(emp)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#124bce]/10 hover:bg-[#124bce]/20 active:scale-95 text-[#8ba7ff] rounded-lg text-xs font-bold border border-[#124bce]/20 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89.112l-2.848.316.316-2.848a4.5 4.5 0 011.112-1.89l12.48-12.48z" /></svg>
                    Edit Data
                  </button>
                  <button onClick={() => setDeleteConfirm({ show: true, id: emp.idKaryawan, nama: emp.nama })} className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 active:scale-95 text-red-400 rounded-lg text-xs font-bold border border-red-500/20 transition-all">
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* MODAL KONFIRMASI HAPUS CUSTOM */}
      {deleteConfirm?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-8 relative flex flex-col items-center text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-5 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Hapus Karyawan?</h2>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              Anda yakin ingin menghapus <span className="text-white font-bold">{deleteConfirm.nama}</span> dari database? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
            </p>
            <div className="flex w-full gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl transition-colors text-sm border border-white/10">Batal</button>
              <button onClick={executeDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] text-sm">Ya, Hapus Permanen</button>
            </div>
          </div>
        </div>
      )}

      {/* WINDOW MODAL PROFIL DETAIL KARYAWAN */}
      {selectedProfile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-white/5 bg-[#141414] flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center font-black text-2xl shadow-inner">
                  {selectedProfile.nama.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">{selectedProfile.nama}</h2>
                  <p className="text-xs font-mono text-gray-400 font-medium mt-0.5">{selectedProfile.idKaryawan} • {selectedProfile.jabatan || selectedProfile.departemen || "Belum ada jabatan"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProfile(null)} className="text-gray-500 hover:text-white p-2 bg-white/5 rounded-xl transition-colors border border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh] custom-scrollbar text-sm bg-[#0a0a0a]">
              
              <div className="bg-[#111111] p-5 rounded-2xl border border-white/5 space-y-4">
                <h4 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase font-mono">A. Identitas & Kontak Personal</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Nomor KTP (NIK)</p>
                    <p className="text-gray-200 font-mono font-medium">{selectedProfile.nikKtp || "— Belum diisi —"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">No. Handphone / WA</p>
                    <p className="text-gray-200 font-medium">{selectedProfile.noPonsel || "— Belum diisi —"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Alamat Domisili Tetap</p>
                    <p className="text-gray-200 font-medium leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">📍 {selectedProfile.alamatDomisili || "— Belum diisi —"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#111111] p-5 rounded-2xl border border-white/5 space-y-4">
                <h4 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase font-mono">B. Kontrak Kepegawaian Invisual</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase block mb-1">Status Hubungan Kerja</label>
                    <span className="inline-block text-[10px] font-bold bg-white/10 text-white border border-white/20 px-2.5 py-1 rounded-md uppercase tracking-wider">{selectedProfile.status}</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Sisa Jatah Cuti Tahunan</p>
                    <p className="text-gray-200 font-mono font-bold">{selectedProfile.sisaCuti} Hari Kerja</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Tanggal Resmi Bergabung</p>
                    <p className="text-gray-200 font-medium">{selectedProfile.tanggalBergabung || "— Belum diisi HRD —"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Total Masa Kerja Aktif</p>
                    <p className="text-blue-400 font-bold">🕒 {calculateMasaKerja(selectedProfile.tanggalBergabung)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#111111] p-5 rounded-2xl border border-white/5 space-y-4">
                <h4 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase font-mono">C. Informasi Finansial & Payroll</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-4">
                  <div className="md:col-span-2">
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Gaji Pokok Utama</p>
                    <p className="text-green-400 font-bold text-base">{formatRupiah(selectedProfile.gajipokok || selectedProfile.gajiPokok || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Nama Bank Penerima</p>
                    <p className="text-gray-200 font-bold uppercase">{selectedProfile.namaBank || "— Belum diisi —"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Nomor Rekening Bank</p>
                    <p className="text-white font-mono font-bold text-base tracking-widest bg-white/5 px-2 py-1 rounded inline-block border border-white/10">{selectedProfile.noRekening || "— Belum diisi —"}</p>
                  </div>
                </div>
              </div>

              <PerformancePanel idKaryawan={selectedProfile.idKaryawan} editable />
            </div>

            <div className="p-4 border-t border-white/5 bg-[#141414] flex gap-3">
              <button onClick={() => { setSelectedProfile(null); openEditModal(selectedProfile); }} className="w-1/2 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded-xl text-sm transition-all shadow-lg">⚙️ Edit Seluruh Data</button>
              <button onClick={() => setSelectedProfile(null)} className="w-1/2 py-3 bg-[#1a1a1a] hover:bg-[#222222] border border-white/10 text-white font-bold rounded-xl text-sm transition-colors">Tutup Profil</button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL FORMULIR (TAMBAH / EDIT KARYAWAN) */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-white/5 bg-[#141414] flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">{isEditMode ? "Ubah Data Staf" : "Registrasi Karyawan Baru"}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg border border-white/5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <form onSubmit={handleSaveData} className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-6 bg-[#0a0a0a]">
              
              <div className="bg-[#111111] p-5 rounded-xl border border-white/5">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 font-mono">A. Identitas Primer Karyawan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">ID Karyawan</label>
                    <input required type="text" disabled={isEditMode} value={formData.idKaryawan} onChange={(e) => setFormData({...formData, idKaryawan: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Nama Lengkap</label>
                    <input required type="text" value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Email Pribadi / Kantor</label>
                    <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">No. Handphone</label>
                    <input type="text" value={formData.noPonsel} onChange={(e) => setFormData({...formData, noPonsel: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none placeholder-gray-600" placeholder="08xxxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Nomor KTP (NIK)</label>
                    <input type="text" placeholder="16 Digit..." value={formData.nikKtp} onChange={(e) => setFormData({...formData, nikKtp: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none font-mono" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Alamat Domisili</label>
                    <input type="text" placeholder="Alamat lengkap..." value={formData.alamatDomisili} onChange={(e) => setFormData({...formData, alamatDomisili: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none" />
                  </div>
                </div>
              </div>

              <div className="bg-[#111111] p-5 rounded-xl border border-white/5">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 font-mono">B. Kontrak & Kepegawaian</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Departemen / Jabatan</label>
                    <input type="text" value={formData.jabatan} onChange={(e) => setFormData({...formData, jabatan: e.target.value})} placeholder="Contoh: UI/UX Designer" className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none">
                      <option value="PKWT (Kontrak)">PKWT (Kontrak)</option>
                      <option value="Tetap">Tetap</option>
                      <option value="Tetap Percobaan (Probation)">Tetap Percobaan (Probation)</option>
                      <option value="Internship">Internship (Magang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Sisa Cuti</label>
                    <input type="number" min="0" value={formData.sisaCuti} onChange={(e) => setFormData({...formData, sisaCuti: parseInt(e.target.value) || 0})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Tanggal Resmi Bergabung</label>
                    <input type="date" value={formData.tanggalBergabung} onChange={(e) => setFormData({...formData, tanggalBergabung: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none [color-scheme:dark]" />
                  </div>

                  <div className="md:col-span-3 grid grid-cols-2 gap-4 bg-[#124bce]/[0.04] border border-[#124bce]/20 rounded-xl p-4">
                    <div className="col-span-2 -mb-1">
                      <p className="text-[11px] font-bold text-[#8ba7ff] uppercase">Jam Kerja Standar</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Dipakai untuk menentukan status "Terlambat". Tim dengan jam berbeda bisa diatur di sini.</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Jam Masuk</label>
                      <input type="time" value={formData.jamMasuk} onChange={(e) => setFormData({...formData, jamMasuk: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#124bce] outline-none [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Jam Keluar</label>
                      <input type="time" value={formData.jamKeluar} onChange={(e) => setFormData({...formData, jamKeluar: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#124bce] outline-none [color-scheme:dark]" />
                    </div>
                  </div>

                  {formData.status === "Internship" && (
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5 bg-cyan-500/[0.04] border border-cyan-500/20 rounded-xl p-4">
                      <div className="md:col-span-2 flex items-center gap-2">
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Data Magang</span>
                        <span className="text-[10px] text-gray-600">— hanya untuk status Internship</span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Institusi / Kampus Asal</label>
                        <input type="text" value={formData.institusiMagang} onChange={(e) => setFormData({...formData, institusiMagang: e.target.value})} placeholder="Universitas / SMK..." className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-cyan-500/50 outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Tanggal Selesai Magang</label>
                        <input type="date" value={formData.tanggalSelesaiMagang} onChange={(e) => setFormData({...formData, tanggalSelesaiMagang: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-cyan-500/50 outline-none [color-scheme:dark]" />
                      </div>
                    </div>
                  )}
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-[#8ba7ff] mb-1.5 uppercase">Role Akses · Daily Task Tracker</label>
                    <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full bg-[#1c1c1c] border border-[#2b5cd5]/30 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#2b5cd5] outline-none">
                      <option value="member">Member — hanya melihat &amp; mengerjakan tugasnya sendiri (My Tasks)</option>
                      <option value="manager">Manager — mengelola seluruh board (buat, assign, atur semua tugas)</option>
                    </select>
                    <p className="text-[10px] text-gray-600 mt-1.5">Menentukan tampilan menu Daily Task karyawan. Bisa diubah kapan saja lewat tombol Edit.</p>
                  </div>

                  {formData.role === "manager" && (
                    <div className="md:col-span-3 space-y-3">
                      <div className="bg-[#124bce]/5 border border-[#124bce]/20 rounded-lg p-4">
                        <label className="block text-[11px] font-bold text-[#8ba7ff] mb-1 uppercase">Board yang boleh diakses</label>
                        <p className="text-[10px] text-gray-500 mb-3">Kosongkan = akses SEMUA board. Centang untuk membatasi ke board tertentu saja.</p>
                        <div className="flex flex-wrap gap-2">
                          {allBoards.length === 0 ? (
                            <span className="text-[11px] text-gray-600">Belum ada board di Daily Task.</span>
                          ) : (
                            allBoards.map((b) => {
                              const key = b.toLowerCase();
                              const on = formData.boardAccess.includes(key);
                              return (
                                <button
                                  type="button"
                                  key={b}
                                  onClick={() => setFormData({ ...formData, boardAccess: on ? formData.boardAccess.filter((x) => x !== key) : [...formData.boardAccess, key] })}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${on ? "bg-[#124bce] text-white border-[#124bce]" : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"}`}
                                >
                                  {on ? "✓ " : ""}{b}
                                </button>
                              );
                            })
                          )}
                        </div>
                        <p className={`text-[10px] mt-3 ${formData.boardAccess.length ? "text-[#e85a92]" : "text-gray-600"}`}>
                          {formData.boardAccess.length ? `Dibatasi ke ${formData.boardAccess.length} board — board lain tersembunyi otomatis.` : "Saat ini: akses semua board."}
                        </p>
                      </div>
                      <label className="flex items-center justify-between bg-[#1c1c1c] border border-white/10 rounded-lg px-4 py-3 cursor-pointer">
                        <div className="pr-3">
                          <span className="text-sm font-bold text-white">Akses Content Hub</span>
                          <p className="text-[10px] text-gray-500 mt-0.5">Izinkan melihat &amp; mengelola Content Hub (marketing &amp; sosmed).</p>
                        </div>
                        <input type="checkbox" checked={formData.contentHub} onChange={(e) => setFormData({ ...formData, contentHub: e.target.checked })} className="accent-[#124bce] w-4 h-4 shrink-0" />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#111111] p-5 rounded-xl border border-white/5">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 font-mono">C. Rekening Bank & Finansial</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Gaji Pokok bulanan (Rp)</label>
                    <input type="number" value={formData.gajiPokok} onChange={(e) => setFormData({...formData, gajiPokok: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Nama Bank Penerima</label>
                    <input type="text" placeholder="Contoh: BCA..." value={formData.namaBank} onChange={(e) => setFormData({...formData, namaBank: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Nomor Rekening Bank</label>
                    <input type="text" placeholder="Masukan No Rekening..." value={formData.noRekening} onChange={(e) => setFormData({...formData, noRekening: e.target.value})} className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/30 outline-none font-mono" />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="w-1/3 py-3 text-sm font-bold text-gray-300 border border-white/10 rounded-xl hover:bg-[#1a1a1a] transition-all">Batal</button>
                <button type="submit" disabled={isSubmitting} className="w-2/3 py-3 text-sm font-bold text-black bg-white hover:bg-gray-200 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                  {/* === EFEK LOGO BERPUTAR SAAT MENYIMPAN DATA (Loading Button) === */}
                  {isSubmitting && <img src="/logo.png" className="w-4 h-4 animate-spin object-contain" style={{ animationDuration: "3s" }} alt="Loading" />}
                  {isSubmitting ? "Menyimpan..." : "Simpan Data Karyawan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}