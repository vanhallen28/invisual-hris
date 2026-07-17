"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/corporate/utils";
import { getRenewalReminders } from "@/lib/corporate/reminders";
import type { Subscription } from "@/lib/corporate/types";

// Dashboard ditambahkan di langkah terakhir (jadi tab pertama).
const TABS = [
  { href: "/admin/corporate/dokumen", label: "Dokumen" },
  { href: "/admin/corporate/email", label: "Email Hub" },
  { href: "/admin/corporate/langganan", label: "Langganan" },
];

export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [reminderCount, setReminderCount] = useState(0);

  // Hitung langganan yang perlu diingatkan (RLS memastikan hanya role berhak
  // yang mendapat datanya — non-otorisasi = kosong = tak ada badge).
  useEffect(() => {
    let alive = true;
    supabase
      .from("subscriptions")
      .select("renewal_date, status")
      .then(({ data }) => {
        if (!alive) return;
        setReminderCount(getRenewalReminders((data ?? []) as Subscription[]).length);
      });
    return () => {
      alive = false;
    };
  }, []);

  const onLangganan = pathname.startsWith("/admin/corporate/langganan");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-3">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          const showBadge = t.href === "/admin/corporate/langganan" && reminderCount > 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-[#124bce] text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white",
              )}
            >
              {t.label}
              {showBadge && (
                <span
                  className={cn(
                    "grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11px] font-bold",
                    active ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-300",
                  )}
                >
                  {reminderCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {reminderCount > 0 && !onLangganan && (
        <Link
          href="/admin/corporate/langganan"
          className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm transition-colors hover:bg-amber-500/15"
        >
          <Bell className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-amber-200">
            <span className="font-semibold text-amber-300">{reminderCount} langganan</span> mendekati / lewat masa perpanjangan — lihat Langganan.
          </span>
        </Link>
      )}

      {children}
    </div>
  );
}
