"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Pencil,
  Trash2,
  Mail,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AddEmailModal } from "@/components/corporate/AddEmailModal";
import { formatDate, cn } from "@/lib/corporate/utils";
import type { EmailAccount } from "@/lib/corporate/types";
import { useToast } from "@/components/Toast";

export function EmailHubView() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmailAccount | null>(null);

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    setAccounts((data ?? []) as EmailAccount[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      `${a.email} ${a.label ?? ""} ${a.notes ?? ""}`.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  const toggleReveal = (id: string) =>
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));

  const copyPassword = async (a: EmailAccount) => {
    try {
      await navigator.clipboard.writeText(a.password);
      setCopiedId(a.id);
      setTimeout(() => setCopiedId((c) => (c === a.id ? null : c)), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (a: EmailAccount) => {
    setEditing(a);
    setModalOpen(true);
  };

  const remove = async (a: EmailAccount) => {
    if (!(await toast.konfirmasi(`Hapus akun "${a.email}" dari daftar?`, { labelYa: "Hapus" }))) return;
    await supabase.from("email_accounts").delete().eq("id", a.id);
    setAccounts((prev) => prev.filter((x) => x.id !== a.id));
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Email Perusahaan</h1>
          <p className="mt-1 text-sm text-gray-400">
            Daftar akun email perusahaan beserta password-nya.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#124bce] px-3 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tambah Email
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari email, label, catatan…"
          className="h-9 w-full rounded-lg border border-white/10 bg-[#1c1c1c] pl-9 pr-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#124bce]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-white/15 py-20 text-center">
          <div className="text-gray-500">
            <Mail className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <div className="text-sm font-medium text-gray-200">
              {query ? "Tidak ada yang cocok" : "Belum ada akun email"}
            </div>
            <div className="mt-1 text-xs">
              {query ? "Coba kata kunci lain." : 'Klik "Tambah Email" untuk menambahkan akun.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left font-mono text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Password</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Label</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Catatan</th>
                <th className="hidden px-4 py-3 font-medium xl:table-cell">Ditambahkan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((a) => {
                const isShown = !!revealed[a.id];
                return (
                  <tr key={a.id} className="hover:bg-white/5">
                    {/* Email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#124bce]/15 text-[#b3c5ff]">
                          <Mail className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium text-gray-100">{a.email}</span>
                        <IconBtn onClick={() => copyText(a.email)} label="Salin email">
                          <Copy className="h-3.5 w-3.5" />
                        </IconBtn>
                      </div>
                    </td>

                    {/* Password */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                        <span className="font-mono text-sm text-gray-100">
                          {isShown ? a.password : "••••••••"}
                        </span>
                        <IconBtn
                          onClick={() => toggleReveal(a.id)}
                          label={isShown ? "Sembunyikan" : "Tampilkan"}
                        >
                          {isShown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </IconBtn>
                        <IconBtn onClick={() => copyPassword(a)} label="Salin password">
                          {copiedId === a.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </IconBtn>
                      </div>
                    </td>

                    {/* Label */}
                    <td className="hidden px-4 py-3 md:table-cell">
                      {a.label ? (
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-gray-300">{a.label}</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="hidden max-w-[16rem] px-4 py-3 lg:table-cell">
                      <span className="line-clamp-1 text-gray-400" title={a.notes ?? ""}>
                        {a.notes || "—"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="hidden px-4 py-3 font-mono text-xs text-gray-500 xl:table-cell">
                      {formatDate(a.created_at).split(",")[0]}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn onClick={() => openEdit(a)} label="Edit">
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn onClick={() => remove(a)} label="Hapus" danger>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddEmailModal
        open={modalOpen}
        account={editing}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md text-gray-400 transition-colors hover:bg-white/10",
        danger ? "hover:text-red-400" : "hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-white/10 px-4 py-3.5 last:border-0">
          <div className="h-7 w-7 rounded-md bg-white/5" />
          <div className="h-4 w-48 rounded bg-white/5" />
          <div className="h-4 w-24 rounded bg-white/5" />
          <div className="ml-auto h-4 w-16 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
