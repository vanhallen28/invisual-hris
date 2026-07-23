"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { BillingCycle, SubStatus, Subscription } from "@/lib/corporate/types";

const inputCls =
  "h-9 w-full rounded-lg border border-white/10 bg-input px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-primer [color-scheme:dark]";

/** Form tambah/edit data langganan platform. */
export function AddSubscriptionModal({
  open,
  sub,
  onClose,
  onSaved,
}: {
  open: boolean;
  sub: Subscription | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [platform, setPlatform] = useState("");
  const [plan, setPlan] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [renewal, setRenewal] = useState("");
  const [status, setStatus] = useState<SubStatus>("active");
  const [accountEmail, setAccountEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!sub;

  useEffect(() => {
    if (open) {
      setPlatform(sub?.platform ?? "");
      setPlan(sub?.plan ?? "");
      setPrice(sub?.price != null ? String(sub.price) : "");
      setCurrency(sub?.currency ?? "IDR");
      setCycle(sub?.billing_cycle ?? "monthly");
      setRenewal(sub?.renewal_date ?? "");
      setStatus(sub?.status ?? "active");
      setAccountEmail(sub?.account_email ?? "");
      setNotes(sub?.notes ?? "");
      setError(null);
    }
  }, [open, sub]);

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
      platform: platform.trim(),
      plan: plan.trim() || null,
      price: price.trim() ? Number(price) : null,
      currency: currency.trim() || "IDR",
      billing_cycle: cycle,
      renewal_date: renewal || null,
      status,
      account_email: accountEmail.trim() || null,
      notes: notes.trim() || null,
    };

    const { error: err } = isEdit
      ? await supabase.from("subscriptions").update(payload).eq("id", sub!.id)
      : await supabase.from("subscriptions").insert(payload);

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
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/80 p-4 pt-[8vh] backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-kartu shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? "Edit langganan" : "Tambah langganan"}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="max-h-[74vh] space-y-3 overflow-y-auto p-5 custom-scrollbar">
          <Field label="Nama platform *">
            <input
              required
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={inputCls}
              placeholder='mis. "Figma", "Canva", "AWS"'
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Paket">
              <input
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className={inputCls}
                placeholder='mis. "Pro"'
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SubStatus)}
                className={inputCls}
              >
                <option value="active">Aktif</option>
                <option value="trial">Trial</option>
                <option value="cancelled">Berhenti</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Biaya">
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
            <Field label="Mata uang">
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputCls}
                placeholder="IDR"
              />
            </Field>
            <Field label="Siklus">
              <select
                value={cycle}
                onChange={(e) => setCycle(e.target.value as BillingCycle)}
                className={inputCls}
              >
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
                <option value="one_time">Sekali</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Perpanjangan berikutnya">
              <input
                type="date"
                value={renewal}
                onChange={(e) => setRenewal(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Akun email terkait">
              <input
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                className={inputCls}
                placeholder="akun@perusahaan.com"
              />
            </Field>
          </div>

          <Field label="Catatan (opsional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputCls} resize-y py-2`}
              placeholder="Catatan tambahan…"
            />
          </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  );
}
