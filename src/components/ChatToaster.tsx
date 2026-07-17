"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadChannels } from "@/lib/tracker/chat";

interface ToastMsg {
  id: string;
  channel: string;
  body: string;
}

/**
 * Notifikasi chat global gaya Telegram Desktop: toast di pojok kanan-bawah saat
 * ada pesan masuk, tampil di halaman mana pun. Memakai Supabase Realtime pada
 * INSERT tabel chat_messages. Tidak muncul bila: sedang di halaman Chat, channel
 * tak terlihat oleh kita, atau pesan yang kita kirim sendiri. Aktif hanya saat login.
 */
export default function ChatToaster() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const myIdRef = useRef<string | null>(null);
  const channelsRef = useRef<Record<string, string>>({}); // channel_id -> name
  const audioRef = useRef<HTMLAudioElement | null>(null); // nada notifikasi
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let active = true;
    let sub: any = null;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!active || !uid) return; // belum login → tak ada toast
      myIdRef.current = uid;

      try {
        const chs = await loadChannels(supabase);
        const map: Record<string, string> = {};
        (chs || []).forEach((c: any) => {
          if (c?.id) map[c.id] = c.name || "chat";
        });
        channelsRef.current = map;
      } catch {
        /* abaikan — tanpa peta channel, filter channel dilewati */
      }

      sub = supabase
        .channel("global-chat-toast")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload: any) => {
            const m = payload.new || {};
            const channelId = m.channel_id;
            const senderId = m.member_id ?? m.sender_id ?? m.user_id ?? m.author_id ?? null;
            const map = channelsRef.current;

            // Lewati bila sedang di halaman chat (lihat langsung),
            // channel tak terlihat, atau pesan sendiri.
            if (pathRef.current.includes("/chat")) return;
            if (Object.keys(map).length > 0 && channelId && !map[channelId]) return;
            if (senderId && senderId === myIdRef.current) return;

            const channelName = map[channelId] || "chat";
            const raw = (m.content ?? "").toString().trim();
            const body = raw || "[Lampiran]";
            const id = m.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

            setToasts((prev) => [...prev, { id, channel: channelName, body }].slice(-4));
            // Nada notifikasi (mungkin diblokir browser sampai ada interaksi pengguna)
            try {
              if (!audioRef.current) audioRef.current = new Audio("/notif.mp3");
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            } catch { /* abaikan */ }
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== id));
            }, 6000);
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (sub) supabase.removeChannel(sub);
    };
  }, []);

  if (toasts.length === 0) return null;

  const goChat = () => {
    router.push(pathname.startsWith("/admin") ? "/admin/chat" : "/user/chat");
    setToasts([]);
  };

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-4 right-4 z-[99999] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={goChat}
          className="pointer-events-auto flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#0f0f0f]/95 px-4 py-3 shadow-2xl backdrop-blur-md transition-colors hover:border-[#124bce]/40 animate-in slide-in-from-right-8 fade-in duration-300"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#124bce]/20 text-[#b3c5ff]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-white">#{t.channel}</div>
            <div className="line-clamp-2 text-[11px] text-gray-400">{t.body}</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.id);
            }}
            aria-label="Tutup"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-white/10 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
