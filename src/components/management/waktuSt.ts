// src/components/management/waktuSt.ts — helper tampilan waktu WIB & label divisi untuk Serah Terima.
import { teksTanggalISO } from "@/lib/tanggalTampil";
import { isoWib } from "@/lib/management/hariKerja";

export const LABEL_DIVISI_ST: Record<string, string> = {
  sosmed: "Sosmed", service: "Service", marketplace: "Marketplace", hr: "HR", pm: "PM", owner: "Owner (Dea)",
};

/** Instan → "2026-11-24T15:30" (nilai input datetime-local dalam WIB). */
export const inputWib = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 16);

/** ISO → "Sel, 24 Nov 18.00" (WIB). */
export function waktuWib(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3_600_000);
  return `${teksTanggalISO(isoWib(new Date(iso)), { tahun: false })} ${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
