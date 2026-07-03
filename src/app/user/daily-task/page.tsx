// src/app/user/daily-task/page.tsx
"use client";
import EmbeddedTracker from "@/components/tracker/EmbeddedTracker";

// Sesi login HRIS dipakai otomatis. Konten menyesuaikan peran (manajer=board, member=My Tasks).
export default function DailyTaskPage() {
  return <EmbeddedTracker />;
}
