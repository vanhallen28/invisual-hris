// src/lib/management/pedomanRender.ts
// Markdown Pedoman → HTML aman. Khusus peramban (DOMPurify butuh DOM).
// • Id judul level 2–3 dibuat dengan pembuatId() yang sama dengan daftarIsi() → tautan daftar isi selalu cocok.
// • Instans DOMPurify sendiri, BUKAN yang dipakai sanitasiHtmlDokumen: kait global di sana menambah target=_blank
//   pada semua tautan (merusak lompatan #bagian) dan daftar tagnya membuang id & tabel.
import { Marked, type Tokens } from "marked";
import DOMPurify, { type DOMPurify as TipeDOMPurify } from "dompurify";
import { pembuatId } from "./pedoman";

const TAG = ["p", "br", "h1", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "code", "pre", "blockquote", "hr", "a",
  "table", "thead", "tbody", "tr", "th", "td"];
const ATRIBUT = ["href", "id", "title"];
const URL_AMAN = /^(?:https?:|mailto:|#|\/(?![/\\]))/i;   // "/x" boleh; "//x" & "/\x" (= situs lain) tidak

let pemurni: TipeDOMPurify | null = null;

/** Judul level 2–3 dari HTML hasil render (untuk daftar isi yang PASTI cocok dengan id di halaman). */
export function judulDariHtml(html: string): { id: string; teks: string; level: 2 | 3 }[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("h2[id], h3[id]")).map((h) => ({ id: h.id, teks: (h.textContent || "").trim(), level: h.tagName === "H2" ? 2 : 3 }));
}

export function renderPedoman(md: string): string {
  if (typeof window === "undefined") return "";
  pemurni ??= DOMPurify(window);
  const id = pembuatId();
  const m = new Marked({ gfm: true, breaks: false });
  m.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, t: Tokens.Heading) {
        const isi = this.parser.parseInline(t.tokens);
        return t.depth === 2 || t.depth === 3 ? `<h${t.depth} id="${id(t.text)}">${isi}</h${t.depth}>\n` : `<h${t.depth}>${isi}</h${t.depth}>\n`;
      },
    },
  });
  const html = m.parse(String(md ?? ""), { async: false }) as string;
  return pemurni.sanitize(html, { ALLOWED_TAGS: TAG, ALLOWED_ATTR: ATRIBUT, ALLOW_DATA_ATTR: false, ALLOWED_URI_REGEXP: URL_AMAN });
}
