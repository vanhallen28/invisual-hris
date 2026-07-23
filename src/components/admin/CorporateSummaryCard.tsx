"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Mail, CreditCard, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getRenewalReminders } from "@/lib/corporate/reminders";
import type { Subscription } from "@/lib/corporate/types";

/**
 * Ringkasan Corporate Vault untuk Dasbor admin. Angka dibaca lewat RLS —
 * hanya admin/manajer ber-izin yang mendapat datanya (lainnya melihat 0).
 */
export function CorporateSummaryCard() {
  const [counts, setCounts] = useState({ files: 0, emails: 0, subs: 0 });
  const [reminderCount, setReminderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [f, e, s, subsData] = await Promise.all([
        supabase.from("files").select("*", { count: "exact", head: true }),
        supabase.from("email_accounts").select("*", { count: "exact", head: true }),
        supabase.from("subscriptions").select("*", { count: "exact", head: true }),
        supabase.from("subscriptions").select("renewal_date, status"),
      ]);
      if (!alive) return;
      setCounts({ files: f.count ?? 0, emails: e.count ?? 0, subs: s.count ?? 0 });
      setReminderCount(getRenewalReminders((subsData.data ?? []) as Subscription[]).length);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const stats = [
    { label: "Dokumen", value: counts.files, icon: FolderOpen, href: "/admin/corporate/dokumen" },
    { label: "Akun Email", value: counts.emails, icon: Mail, href: "/admin/corporate/email" },
    { label: "Langganan", value: counts.subs, icon: CreditCard, href: "/admin/corporate/langganan" },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-primer/20 bg-primer/15 text-tint">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </span>
          <div>
            <h3 className="text-base font-bold leading-tight text-white">Corporate Vault</h3>
            <p className="font-mono text-[11px] text-gray-500">Arsip &amp; aset internal</p>
          </div>
        </div>
        <Link
          href="/admin/corporate"
          className="shrink-0 text-xs font-medium text-tint hover:underline"
        >
          Buka →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((st) => (
          <Link
            key={st.label}
            href={st.href}
            className="rounded-lg border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-white/25"
          >
            <st.icon className="h-4 w-4 text-gray-400" />
            <div className="mt-1.5 font-mono text-2xl font-bold text-white">
              {loading ? "–" : st.value}
            </div>
            <div className="text-[10px] text-gray-500">{st.label}</div>
          </Link>
        ))}
      </div>

      {reminderCount > 0 && (
        <Link
          href="/admin/corporate/langganan"
          className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs transition-colors hover:bg-amber-500/15"
        >
          <Bell className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="text-amber-200">
            <span className="font-semibold text-amber-300">{reminderCount} langganan</span> mendekati / lewat perpanjangan
          </span>
        </Link>
      )}
    </div>
  );
}
