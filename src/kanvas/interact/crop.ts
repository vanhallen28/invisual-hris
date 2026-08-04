import type { SceneNode } from '@/kanvas/doc/types'
import { resizeFrom, type Box, type Handle } from './transform'

/**
 * Matematika potong gambar (crop) — MURNI, tanpa React maupun Yjs, sehingga
 * bisa diuji dengan objek biasa.
 *
 * Model: rect gambar dinyatakan sebagai PECAHAN kotak node. Rect dunia
 *   R = { x: node.x + ix·w, y: node.y + iy·h, w: iw·w, h: ih·h }.
 * Invarian yang dijaga SETIAP operasi:
 *   1. R menutup kotak  → ix≤0, iy≤0, ix+iw≥1, iy+ih≥1  (tak ada celah kosong)
 *   2. R berasio gambar → agar `preserveAspectRatio="none"` tak mendistorsi
 */

export type Crop = { ix: number; iy: number; iw: number; ih: number }

/** Batas seberapa besar gambar boleh diperbesar relatif kotak (anti-liar). */
const MAKS_SKALA = 20

/** Paksa rect menutup kotak: iw,ih ≥ 1 dan posisi di dalam rentang sah. */
export function clampMenutup(c: Crop): Crop {
  const iw = Math.max(1, c.iw)
  const ih = Math.max(1, c.ih)
  // Untuk menutup, kiri rect ≤ kiri kotak (ix ≤ 0) DAN kanan rect ≥ kanan
  // kotak (ix + iw ≥ 1 → ix ≥ 1 - iw). Karena iw ≥ 1, rentang [1-iw, 0] valid.
  const ix = Math.min(0, Math.max(1 - iw, c.ix))
  const iy = Math.min(0, Math.max(1 - ih, c.iy))
  return { ix, iy, iw, ih }
}

/**
 * Crop awal "cover-fit": gambar berasio `rasioAsli` (lebar/tinggi) menutupi
 * kotak dan terpusat. Inilah keadaan saat pertama masuk mode potong.
 */
export function cropCoverAwal(kotak: { w: number; h: number }, rasioAsli: number): Crop {
  const rasioKotak = kotak.h > 0 ? kotak.w / kotak.h : 1
  const ra = rasioAsli > 0 ? rasioAsli : rasioKotak
  if (ra >= rasioKotak) {
    // Gambar lebih lebar dari kotak → tinggi pas, lebar melimpah ke samping.
    const iw = ra / rasioKotak
    return { ix: (1 - iw) / 2, iy: 0, iw, ih: 1 }
  }
  // Gambar lebih tinggi → lebar pas, tinggi melimpah ke atas-bawah.
  const ih = rasioKotak / ra
  return { ix: 0, iy: (1 - ih) / 2, iw: 1, ih }
}

/** Geser (pan) gambar sebesar pecahan kotak, lalu jaga tetap menutup. */
export function geserCrop(c: Crop, dFracX: number, dFracY: number): Crop {
  return clampMenutup({ ix: c.ix + dFracX, iy: c.iy + dFracY, iw: c.iw, ih: c.ih })
}

/**
 * Skala isi gambar seragam faktor `k` di sekitar titik (pusatX,pusatY) dalam
 * pecahan kotak (0..1). Rasio iw/ih dijaga (keduanya dikali faktor sama), jadi
 * gambar tak pernah mendistorsi. Tak boleh mengecil sampai muncul celah, tak
 * boleh membesar melewati MAKS_SKALA.
 */
export function skalaCrop(c: Crop, k: number, pusatX = 0.5, pusatY = 0.5): Crop {
  // Faktor terkecil: dimensi terkecil tak boleh turun di bawah 1 (menutup).
  const kMin = 1 / Math.min(c.iw, c.ih)
  // Faktor terbesar: dimensi terbesar tak boleh melewati MAKS_SKALA.
  const kMaks = Math.max(kMin, MAKS_SKALA / Math.max(c.iw, c.ih))
  const kk = Math.min(Math.max(k, kMin), kMaks)

  const iw = c.iw * kk
  const ih = c.ih * kk
  // Posisi titik pusat pada gambar (0..1 dalam gambar) dijaga tetap.
  const ux = (pusatX - c.ix) / c.iw
  const uy = (pusatY - c.iy) / c.ih
  const ix = pusatX - ux * iw
  const iy = pusatY - uy * ih
  return clampMenutup({ ix, iy, iw, ih })
}

/**
 * Ubah bentuk jendela (kotak node) lewat sebuah gagang, sambil menjaga rect
 * gambar TETAP di tempatnya secara absolut (perilaku Figma: jendela menyingkap
 * lebih banyak/sedikit, gambar tak ikut meregang). Bila jendela tumbuh melewati
 * gambar, gambar diperbesar seragam seperlunya agar tetap menutup.
 *
 * `resizeFrom` dipakai ulang untuk menghitung kotak baru (termasuk koreksi
 * rotasi & titik jangkar) — tidak ada matematika resize yang digandakan.
 */
export function resizeJendela(
  node: SceneNode,
  c: Crop,
  handle: Handle,
  ptWorldX: number,
  ptWorldY: number
): { kotak: Box; crop: Crop } {
  // Rect gambar absolut (ruang lokal sumbu-sejajar) dari crop lama.
  const Rx = node.x + c.ix * node.w
  const Ry = node.y + c.iy * node.h
  const Rw = c.iw * node.w
  const Rh = c.ih * node.h

  // Kotak baru: reshape BEBAS (bukan proporsional) mengikuti gagang.
  const kotak = resizeFrom(node, handle, ptWorldX, ptWorldY, false)

  // Hitung ulang pecahan crop terhadap kotak baru, menjaga rect absolut.
  let ix = (Rx - kotak.x) / kotak.w
  let iy = (Ry - kotak.y) / kotak.h
  let iw = Rw / kotak.w
  let ih = Rh / kotak.h

  // Jika rect tak lagi menutup (jendela melebihi gambar), perbesar rect
  // seragam di sekitar pusatnya agar rasio tetap terjaga, lalu clamp posisi.
  if (iw < 1 || ih < 1) {
    const s = Math.max(iw < 1 ? 1 / iw : 1, ih < 1 ? 1 / ih : 1)
    const cxu = ix + iw / 2
    const cyu = iy + ih / 2
    iw *= s
    ih *= s
    ix = cxu - iw / 2
    iy = cyu - ih / 2
  }

  return { kotak, crop: clampMenutup({ ix, iy, iw, ih }) }
}

/**
 * Menyetel jendela (kotak node) ke sebuah rasio (mis. 16:9) sekali: mengambil
 * kotak TERBESAR berasio `rasioTarget` yang masih MUAT di dalam gambar saat ini,
 * terpusat pada jendela lama. Gambar tidak bergeser (rect absolutnya tetap), dan
 * karena kotak baru ⊆ rect gambar, jaminan "menutup" otomatis terpenuhi.
 */
export function snapRasio(
  node: SceneNode,
  c: Crop,
  rasioTarget: number
): { kotak: Box; crop: Crop } {
  const R = { x: node.x + c.ix * node.w, y: node.y + c.iy * node.h, w: c.iw * node.w, h: c.ih * node.h }
  const rasioR = R.h > 0 ? R.w / R.h : 1
  const t = rasioTarget > 0 ? rasioTarget : rasioR

  // Kotak terbesar berasio t yang muat di R.
  let bw: number, bh: number
  if (t >= rasioR) { bw = R.w; bh = R.w / t }
  else { bh = R.h; bw = R.h * t }

  // Pusatkan pada pusat jendela lama, lalu geser agar tetap di dalam R.
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  const bx = Math.min(R.x + R.w - bw, Math.max(R.x, cx - bw / 2))
  const by = Math.min(R.y + R.h - bh, Math.max(R.y, cy - bh / 2))

  const kotak = { x: bx, y: by, w: bw, h: bh }
  const crop = clampMenutup({ ix: (R.x - bx) / bw, iy: (R.y - by) / bh, iw: R.w / bw, ih: R.h / bh })
  return { kotak, crop }
}

/** Memutar sebuah VEKTOR (bukan titik) sebesar `deg`. Untuk pan pada node berotasi. */
export function putarVektor(dx: number, dy: number, deg: number): { x: number; y: number } {
  if (!deg) return { x: dx, y: dy }
  const rad = (deg * Math.PI) / 180
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}
