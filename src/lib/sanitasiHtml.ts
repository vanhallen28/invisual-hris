// src/lib/sanitasiHtml.ts
// Penyaring HTML untuk konten yang ditulis pengguna lalu ditampilkan lagi sebagai HTML
// (editor dokumen invisual.docs). Audit keamanan 22 Okt 2026: dokumen dulu dipasang mentah
// ke innerHTML → XSS tersimpan (mis. <img onerror=…>) bisa mencuri sesi HR yang membukanya.
// Hanya tag/atribut format dokumen yang lolos; tautan & gambar hanya http(s); tanpa skrip,
// atribut on*, style, iframe, svg, form. Dijalankan di peramban (DOMPurify butuh DOM).
import DOMPurify from "dompurify";

const TAG = ["p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike", "h1", "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "blockquote", "pre", "code", "hr", "sub", "sup", "font"];
const ATRIBUT = ["href", "src", "alt", "title", "target", "rel"];
const URL_AMAN = /^(?:https?:|mailto:|#|\/(?!\/))/i;

let kaitTerpasang = false;
function pasangKait() {
  if (kaitTerpasang) return;
  kaitTerpasang = true;
  DOMPurify.addHook("afterSanitizeAttributes", (el) => {
    if (el.tagName === "A") {
      const href = el.getAttribute("href") || "";
      if (href && !URL_AMAN.test(href.trim())) el.removeAttribute("href");
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
    if (el.tagName === "IMG") {
      const src = el.getAttribute("src") || "";
      if (!/^https?:/i.test(src.trim())) el.removeAttribute("src");
    }
  });
}

/** HTML dokumen yang aman untuk innerHTML. Di luar peramban → string kosong (tidak dipakai di server). */
export function sanitasiHtmlDokumen(html: string | null | undefined): string {
  if (typeof window === "undefined") return "";
  pasangKait();
  return DOMPurify.sanitize(String(html ?? ""), {
    ALLOWED_TAGS: TAG,
    ALLOWED_ATTR: ATRIBUT,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: URL_AMAN,
  });
}

/** Escape teks biasa untuk disisipkan ke string HTML (nama file, label). */
export const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** URL http(s) yang dirapikan (tanpa skema → https://), atau null bila skema lain (javascript:, data:, …). */
export function urlTautanAman(masukan: string | null | undefined): string | null {
  const t = String(masukan ?? "").trim();
  if (!t) return null;
  const u = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t.replace(/^\/\//, "")}`;
  return /^https?:\/\//i.test(u) ? u : null;
}
