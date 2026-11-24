// src/lib/server/kirimPush.ts — SERVER SAJA (memakai service_role & VAPID private key).
// Mengirim Web Push ke daftar member_id (= auth user id) lalu membersihkan langganan mati (404/410).
// Diekstrak dari /api/push/send TANPA mengubah perilaku: pemotongan judul/isi, URL hanya jalur internal HRIS,
// tag bawaan "invisual", setVapidDetails hanya bila ada langganan. Dipakai juga oleh /api/management/pengingat.
/* eslint-disable @typescript-eslint/no-explicit-any -- baris push_subscriptions dari Supabase */
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * Audit keamanan 22 Okt 2026: pengirim (karyawan mana pun yang login) dulu bebas menentukan
 * `url` → notifikasi bisa mengarah ke situs phishing. Kini hanya jalur di dalam HRIS
 * ("/…", bukan "//…"); selain itu "/".
 */
export function urlInternal(u: unknown): string {
  const s = String(u ?? "/").trim();
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s.slice(0, 300) : "/";
}

export type IsiPush = { title?: unknown; body?: unknown; url?: unknown; tag?: unknown };
export type HasilPush = { sent: number; dead: number; langganan: number };

export async function kirimPush(admin: SupabaseClient, memberIds: string[], isi: IsiPush): Promise<HasilPush> {
  if (!memberIds.length) return { sent: 0, dead: 0, langganan: 0 };
  const { data: subs } = await admin.from("push_subscriptions").select("*").in("member_id", memberIds);
  if (!subs?.length) return { sent: 0, dead: 0, langganan: 0 };

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@invisual.studio", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "", process.env.VAPID_PRIVATE_KEY || "");

  const payload = JSON.stringify({
    title: String(isi?.title || "Invisual HRIS").slice(0, 80),
    body: String(isi?.body || "").slice(0, 160),
    url: urlInternal(isi?.url),
    tag: String(isi?.tag || "invisual"),
  });

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (err: any) {
        // 404/410 = langganan sudah mati → bersihkan
        if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.endpoint);
      }
    }),
  );
  if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
  return { sent, dead: dead.length, langganan: subs.length };
}
