"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, CreditCard, CalendarClock, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AddSubscriptionModal } from "@/components/corporate/AddSubscriptionModal";
import { formatDate, cn } from "@/lib/corporate/utils";
import type { BillingCycle, SubStatus, Subscription } from "@/lib/corporate/types";
import { getRenewalReminders, reminderLabel } from "@/lib/corporate/reminders";

const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "/bln",
  yearly: "/thn",
  one_time: "sekali",
};

const STATUS_META: Record<SubStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-emerald-500/10 text-emerald-400" },
  trial: { label: "Trial", className: "bg-amber-500/10 text-amber-400" },
  cancelled: { label: "Berhenti", className: "bg-red-500/10 text-red-400" },
};

function money(price: number | null, currency: string) {
  if (price == null) return "—";
  try {
    return new Intl.NumberFormat("id-ID").format(price) + " " + currency;
  } catch {
    return `${price} ${currency}`;
  }
}

export function SubscriptionsView() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });
    setSubs((data ?? []) as Subscription[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter((s) =>
      `${s.platform} ${s.plan ?? ""} ${s.account_email ?? ""} ${s.notes ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [subs, query]);

  const reminders = useMemo(() => getRenewalReminders(subs), [subs]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (s: Subscription) => {
    setEditing(s);
    setModalOpen(true);
  };
  const remove = async (s: Subscription) => {
    if (!confirm(`Hapus langganan "${s.platform}"?`)) return;
    await supabase.from("subscriptions").delete().eq("id", s.id);
    setSubs((prev) => prev.filter((x) => x.id !== s.id));
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Langganan Platform</h1>
          <p className="mt-1 text-sm text-gray-400">
            Daftar langganan tools/platform perusahaan beserta biaya &amp; jatuh temponya.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#124bce] px-3 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tambah Langganan
        </button>
      </div>

      {reminders.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">
              {reminders.length} langganan mendekati / lewat masa perpanjangan
            </span>
          </div>
          <ul className="space-y-1.5">
            {reminders.map((r) => (
              <li
                key={r.sub.id}
                className="flex items-center justify-between gap-3 border-t border-amber-500/15 pt-1.5 first:border-0 first:pt-0"
              >
                <span className="min-w-0 truncate text-sm font-medium text-gray-100">{r.sub.platform}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.sub.renewal_date && (
                    <span className="font-mono text-xs text-gray-400">
                      {formatDate(r.sub.renewal_date).split(",")[0]}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                      r.overdue ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-300",
                    )}
                  >
                    {reminderLabel(r)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari platform, paket, akun…"
          className="h-9 w-full rounded-lg border border-white/10 bg-[#1c1c1c] pl-9 pr-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#124bce]"
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-white/15 py-20 text-center">
          <div className="text-gray-500">
            <CreditCard className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <div className="text-sm font-medium text-gray-200">
              {query ? "Tidak ada yang cocok" : "Belum ada langganan"}
            </div>
            <div className="mt-1 text-xs">
              {query ? "Coba kata kunci lain." : 'Klik "Tambah Langganan" untuk mulai.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left font-mono text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Paket</th>
                <th className="px-4 py-3 font-medium">Biaya</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Perpanjangan</th>
                <th className="hidden px-4 py-3 font-medium xl:table-cell">Akun</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((s) => {
                const st = STATUS_META[s.status];
                return (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#124bce]/15 text-[#b3c5ff]">
                          <CreditCard className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium text-gray-100">{s.platform}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {s.plan ? (
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-gray-300">{s.plan}</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-100">{money(s.price, s.currency)}</span>
                      <span className="ml-1 text-[11px] text-gray-500">
                        {CYCLE_LABEL[s.billing_cycle]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          st.className,
                        )}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {s.renewal_date ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-400">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatDate(s.renewal_date).split(",")[0]}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="hidden max-w-[14rem] px-4 py-3 xl:table-cell">
                      <span className="line-clamp-1 text-gray-400" title={s.account_email ?? ""}>
                        {s.account_email || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn onClick={() => openEdit(s)} label="Edit">
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn onClick={() => remove(s)} label="Hapus" danger>
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

      <AddSubscriptionModal
        open={modalOpen}
        sub={editing}
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
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-white/10 px-4 py-3.5 last:border-0">
          <div className="h-7 w-7 rounded-md bg-white/5" />
          <div className="h-4 w-40 rounded bg-white/5" />
          <div className="h-4 w-24 rounded bg-white/5" />
          <div className="ml-auto h-4 w-16 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
