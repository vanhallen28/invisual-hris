"use client";

import { useState, useEffect } from "react";
import { Trash2, X, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ResetRange = "7d" | "30d" | "all";

const RANGES: { key: ResetRange; label: string; desc: string }[] = [
  { key: "7d", label: "7 hari terakhir", desc: "Absensi 7 hari ke belakang" },
  { key: "30d", label: "30 hari terakhir", desc: "Absensi 30 hari ke belakang" },
  { key: "all", label: "Hapus semua", desc: "SELURUH data absensi" },
];

/**
 * MODE TAMPILAN (display-only). Pemilihan rentang + modal konfirmasi password
 * sudah lengkap, TAPI eksekusi belum diaktifkan. Pada langkah akhir, tombol
 * "Reset Sekarang" akan memanggil API server (service_role) yang memverifikasi
 * password khusus (env RESET_ATTENDANCE_PASSWORD) sebelum menghapus data.
 */
export function ResetAbsensiCard() {
  const [range, setRange] = useState<ResetRange | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [includeApprovals, setIncludeApprovals] = useState(false);
  const [allowed, setAllowed] = useState(false); // Owner tak boleh reset → kartu disembunyikan

  useEffect(() => {
    try {
      const s = localStorage.getItem("invisual_session");
      const parsed = s ? JSON.parse(s) : null;
      setAllowed(!(parsed?.isOwner === true));
    } catch {
      setAllowed(true);
    }
  }, []);

  if (!allowed) return null;

  const chosen = RANGES.find((r) => r.key === range) || null;

  const openConfirm = () => {
    if (!range) return;
    setPassword("");
    setNote(null);
    setError(null);
    setIncludeApprovals(false);
    setModalOpen(true);
  };

  const execute = async () => {
    if (!range || !password || busy) return;
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        setError("Sesi Supabase tidak ditemukan. Silakan logout lalu login ulang.");
        return;
      }
      const res = await fetch("/api/reset-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ range, password, includeApprovals }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Gagal mereset data absensi.");
        return;
      }
      setNote(
        `Berhasil. ${json.attendanceDeleted ?? 0} data absensi dihapus` +
          (includeApprovals ? `, ${json.approvalsDeleted ?? 0} pengajuan izin/cuti dihapus.` : "."),
      );
      setPassword("");
    } catch (e: any) {
      setError("Terjadi kesalahan: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400">
            <Trash2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">Reset Absensi</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Hapus data absensi (jam masuk/keluar, keterlambatan, dll) berdasarkan rentang. Tindakan permanen — perlu password khusus.
            </p>
          </div>
        </div>

        {/* Pilih rentang */}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {RANGES.map((r) => {
            const on = range === r.key;
            const isAll = r.key === "all";
            const activeCls = isAll
              ? "border-red-500/40 bg-red-500/10"
              : "border-primer bg-primer/10";
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  on ? activeCls : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <div className={`text-sm font-semibold ${on ? "text-white" : "text-gray-200"}`}>
                  {r.label}
                </div>
                <div className="mt-0.5 text-[10px] text-gray-500">{r.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500">
            {range ? (
              <>
                Terpilih: <span className="font-medium text-gray-300">{chosen?.label}</span>
              </>
            ) : (
              "Pilih rentang dulu untuk melanjutkan."
            )}
          </p>
          <button
            type="button"
            onClick={openConfirm}
            disabled={!range}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      {/* Modal konfirmasi */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Konfirmasi Reset</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
                Kamu akan menghapus{" "}
                <span className="font-bold text-red-300">{chosen?.label.toLowerCase()}</span> data
                absensi. Tindakan ini <span className="font-bold">tidak bisa dibatalkan</span>.
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Password khusus</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password untuk eksekusi"
                    className="h-9 w-full rounded-lg border border-white/10 bg-input pl-9 pr-3 text-sm text-white placeholder-gray-500 outline-none focus:border-primer"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={includeApprovals}
                  onChange={(e) => setIncludeApprovals(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                />
                <span className="text-[11px] text-gray-400">
                  Hapus juga <span className="font-semibold text-gray-300">Izin &amp; Cuti</span> pada rentang yang sama.
                  <span className="mt-0.5 block text-[10px] text-gray-500">Sisa cuti karyawan tidak diubah.</span>
                </span>
              </label>

              {note && (
                <p className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                  {note}
                </p>
              )}
              {error && (
                <p className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={busy}
                  className="h-9 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-gray-300 hover:bg-white/10 disabled:opacity-40"
                >
                  {note ? "Tutup" : "Batal"}
                </button>
                <button
                  type="button"
                  onClick={execute}
                  disabled={!password || busy}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" /> {busy ? "Memproses…" : "Reset Sekarang"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
