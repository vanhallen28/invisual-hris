// src/lib/fokus.ts
// Jebakan fokus untuk dialog/lembar: Tab berputar di dalam kontainer, Escape
// menutup, dan fokus kembali ke elemen pemicu saat ditutup. Murni aksesibilitas —
// tidak mengubah isi atau logika dialog yang memakainya.
"use client";

import { useEffect, useRef, type RefObject } from "react";

const BISA_FOKUS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function daftarFokus(akar: HTMLElement): HTMLElement[] {
  return Array.from(akar.querySelectorAll<HTMLElement>(BISA_FOKUS)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * @param ref     kontainer dialog
 * @param aktif   true saat dialog tampil
 * @param onTutup dipanggil saat Escape ditekan (opsional; boleh fungsi inline)
 */
export function useJebakFokus(ref: RefObject<HTMLElement | null>, aktif: boolean, onTutup?: () => void) {
  // Disimpan di ref agar fungsi inline dari pemanggil tidak memicu efek ulang
  // (yang akan merebut fokus tiap render).
  const tutupRef = useRef(onTutup);
  useEffect(() => {
    tutupRef.current = onTutup;
  });

  useEffect(() => {
    if (!aktif) return;
    const akar = ref.current;
    if (!akar) return;
    const pemicu = document.activeElement as HTMLElement | null;

    // Fokus awal: elemen bertanda data-fokus-awal, atau elemen pertama yang bisa difokus, atau kontainer.
    const awal = akar.querySelector<HTMLElement>("[data-fokus-awal]") || daftarFokus(akar)[0];
    if (awal) awal.focus({ preventScroll: true });
    else {
      if (!akar.hasAttribute("tabindex")) akar.setAttribute("tabindex", "-1");
      akar.focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && tutupRef.current) {
        e.stopPropagation();
        tutupRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const daftar = daftarFokus(akar);
      if (daftar.length === 0) {
        e.preventDefault();
        return;
      }
      const pertama = daftar[0]!;
      const terakhir = daftar[daftar.length - 1]!;
      const aktifEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (aktifEl === pertama || !akar.contains(aktifEl))) {
        e.preventDefault();
        terakhir.focus();
      } else if (!e.shiftKey && (aktifEl === terakhir || !akar.contains(aktifEl))) {
        e.preventDefault();
        pertama.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (pemicu && typeof pemicu.focus === "function" && document.contains(pemicu)) pemicu.focus({ preventScroll: true });
    };
  }, [ref, aktif]);
}
