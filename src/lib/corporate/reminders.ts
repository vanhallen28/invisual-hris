// src/lib/corporate/reminders.ts
// Logika pengingat perpanjangan langganan. Ingatkan bila renewal_date <= REMINDER_DAYS
// hari lagi (termasuk hari ini) ATAU sudah lewat. Status 'cancelled' diabaikan.
import type { Subscription } from "@/lib/corporate/types";

export const REMINDER_DAYS = 2;

export interface RenewalReminder {
  sub: Subscription;
  daysUntil: number; // 0 = hari ini, negatif = sudah lewat
  overdue: boolean;
}

export function getRenewalReminders(
  subs: Subscription[],
  today: Date = new Date(),
): RenewalReminder[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const out: RenewalReminder[] = [];
  for (const s of subs) {
    if (!s.renewal_date || s.status === "cancelled") continue;
    const d = new Date(`${s.renewal_date}T00:00:00`);
    if (isNaN(d.getTime())) continue;
    const days = Math.round((d.getTime() - startOfToday.getTime()) / 86400000);
    if (days <= REMINDER_DAYS) {
      out.push({ sub: s, daysUntil: days, overdue: days < 0 });
    }
  }
  // Paling mendesak dulu: lewat terjauh → hari ini → H-2.
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function reminderLabel(r: RenewalReminder): string {
  if (r.daysUntil < 0) return `Lewat ${Math.abs(r.daysUntil)} hari`;
  if (r.daysUntil === 0) return "Jatuh tempo hari ini";
  if (r.daysUntil === 1) return "Besok";
  return `${r.daysUntil} hari lagi`;
}
