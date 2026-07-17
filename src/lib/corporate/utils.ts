// src/lib/corporate/utils.ts
// Helper mandiri untuk fitur Corporate Vault. `cn` di sini TANPA dependency
// (tak butuh clsx / tailwind-merge) — kelas ditulis eksplisit & tak konflik,
// jadi cukup gabung yang truthy.

export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}

/** 1536 -> "1.5 KB" */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** ISO string -> "12 Feb 2026, 14:30" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO string -> "3h ago" / "2d ago" */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}h lalu`;
  return formatDate(iso).split(",")[0];
}

/** Kelompokkan MIME jadi kategori ikon/preview. */
export function fileKind(mime: string): "pdf" | "image" | "doc" | "sheet" | "other" {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("word") || mime.includes("document")) return "doc";
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return "sheet";
  return "other";
}

/** Bisa dipratinjau inline (tanpa unduh)? */
export function isPreviewable(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}

export const initialsOf = (name?: string | null) =>
  (name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
