"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { unreadByChannel } from "@/lib/tracker/chat";

/**
 * Notifikasi pesan chat belum dibaca di Dasbor admin. Memakai RPC
 * `chat_unread_by_channel` yang sudah ada (via unreadByChannel) lalu
 * menjumlahkannya. Kembali null bila tak ada pesan baru. Disegarkan tiap 30 dtk.
 */
export function ChatNotifCard() {
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchUnread = async () => {
      try {
        const map = await unreadByChannel(supabase);
        if (!alive) return;
        const sum = Object.values(map).reduce((a: number, b) => a + (Number(b) || 0), 0);
        setTotal(sum);
      } catch {
        /* abaikan; biarkan total apa adanya */
      } finally {
        if (alive) setLoaded(true);
      }
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 30000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  if (!loaded || total <= 0) return null;

  return (
    <Link
      href="/admin/chat"
      className="mb-4 flex items-center gap-3 rounded-xl border border-primer/30 bg-primer/10 px-4 py-3 transition-colors hover:bg-primer/15"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primer/20 text-tint">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white">
          {total} pesan chat belum dibaca
        </div>
        <div className="text-[11px] text-gray-400">Ada pesan baru di Chat — klik untuk membuka.</div>
      </div>
      <span className="grid h-6 min-w-[24px] shrink-0 place-items-center rounded-full bg-magenta px-1.5 text-xs font-bold text-white">
        {total > 99 ? "99+" : total}
      </span>
    </Link>
  );
}
