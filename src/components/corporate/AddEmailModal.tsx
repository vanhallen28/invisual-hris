"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { EmailAccount } from "@/lib/corporate/types";

const inputCls =
  "h-9 w-full rounded-lg border border-white/10 bg-input px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-primer";

/**
 * Form tambah/edit AKUN EMAIL (alamat email + password). Untuk brankas
 * kredensial email perusahaan. Password disimpan apa adanya di database.
 * Jika prop `account` diisi → mode edit; jika null → mode tambah baru.
 */
export function AddEmailModal({
  open,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: EmailAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!account;

  // Isi form saat mode edit / reset saat tambah baru.
  useEffect(() => {
    if (open) {
      setEmail(account?.email ?? "");
      setPassword(account?.password ?? "");
      setLabel(account?.label ?? "");
      setNotes(account?.notes ?? "");
      setShowPw(false);
      setError(null);
    }
  }, [open, account]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      email: email.trim(),
      password,
      label: label.trim() || null,
      notes: notes.trim() || null,
    };

    const { error: err } = isEdit
      ? await supabase.from("email_accounts").update(payload).eq("id", account!.id)
      : await supabase.from("email_accounts").insert(payload);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/80 p-4 pt-[10vh] backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-kartu shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? "Edit akun email" : "Tambah akun email"}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Alamat email *</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="akun@perusahaan.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Password *</label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                required
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pl-9 pr-10`}
                placeholder="Password akun email"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label={showPw ? "Sembunyikan" : "Tampilkan"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Label / keterangan (opsional)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputCls}
              placeholder='mis. "Email CS", "Email Finance"'
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Catatan (opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputCls} resize-y py-2`}
              placeholder="Catatan tambahan…"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-gray-300 hover:bg-white/10"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded-lg bg-primer px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan perubahan" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
