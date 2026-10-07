// src/lib/tema.ts
// Tema tampilan: "gelap" (bawaan) atau "terang" (beta). Pilihan disimpan di
// localStorage dan diterapkan sebagai atribut `data-tema` pada <html>;
// seluruh warna dipetakan ulang lewat token di globals.css, bukan per komponen.
// Skrip kecil di app/layout.tsx menerapkannya sebelum React hidrasi (tanpa kedip).
"use client";

import { useSyncExternalStore } from "react";

export type Tema = "gelap" | "terang";
export const KUNCI_TEMA = "invisual_tema";
const ACARA = "invisual-tema";

export function bacaTema(): Tema {
  try { return window.localStorage.getItem(KUNCI_TEMA) === "terang" ? "terang" : "gelap"; } catch { return "gelap"; }
}

export function terapkanTema(t: Tema) {
  const root = document.documentElement;
  if (t === "terang") root.setAttribute("data-tema", "terang");
  else root.removeAttribute("data-tema");
}

export function simpanTema(t: Tema) {
  try {
    if (t === "terang") window.localStorage.setItem(KUNCI_TEMA, "terang");
    else window.localStorage.removeItem(KUNCI_TEMA);
  } catch { /* penyimpanan tak tersedia — tema tetap berlaku untuk sesi ini */ }
  terapkanTema(t);
  window.dispatchEvent(new Event(ACARA));
}

function langganan(cb: () => void) {
  window.addEventListener(ACARA, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(ACARA, cb); window.removeEventListener("storage", cb); };
}

/** Hook: [tema, setTema]. Aman untuk SSR (server selalu "gelap"). */
export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(langganan, bacaTema, () => "gelap" as Tema);
  return [tema, simpanTema];
}
