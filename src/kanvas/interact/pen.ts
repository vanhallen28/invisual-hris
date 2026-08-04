import type { PenPoint } from '@/kanvas/doc/types'

/**
 * Matematika penyuntingan jalur Pen — MURNI, tanpa React/Yjs.
 *
 * Selama mode sunting, jalur dijaga "identitas": kotak node == kotak pembatas
 * titik-titiknya, sehingga koordinat sumber sama dengan posisi lokal (pra-rotasi)
 * di kanvas. Dengan begitu menggeser satu anchor tidak menskalakan yang lain.
 */

export type Kotak = { x: number; y: number; w: number; h: number }

/** Kotak pembatas dari semua koordinat (anchor + handle). */
export function bboxPen(pts: PenPoint[]): Kotak {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const c = (x: number, y: number) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  for (const p of pts) {
    c(p.x, p.y)
    if (p.hix != null && p.hiy != null) c(p.hix, p.hiy)
    if (p.hox != null && p.hoy != null) c(p.hox, p.hoy)
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }
}

/**
 * "Bake" pemetaan sumber→kotak yang sedang berlaku ke dalam koordinat, sehingga
 * kotak node == bbox titik (identitas). Dipakai sekali saat MASUK mode sunting,
 * agar penyuntingan berikutnya berlangsung 1:1 walau node sebelumnya di-resize.
 */
export function normalisasiPen(pts: PenPoint[], node: Kotak): PenPoint[] {
  const bb = bboxPen(pts)
  const sx = node.w / bb.w
  const sy = node.h / bb.h
  const map = (x: number, y: number) => ({ x: node.x + (x - bb.x) * sx, y: node.y + (y - bb.y) * sy })
  return pts.map((p) => {
    const a = map(p.x, p.y)
    const q: PenPoint = { x: a.x, y: a.y }
    if (p.hix != null && p.hiy != null) { const h = map(p.hix, p.hiy); q.hix = h.x; q.hiy = h.y }
    if (p.hox != null && p.hoy != null) { const h = map(p.hox, p.hoy); q.hox = h.x; q.hoy = h.y }
    return q
  })
}

/** Geser anchor ke-i sebesar (dx,dy); handle-nya ikut bergeser. */
export function geserAnchor(pts: PenPoint[], i: number, dx: number, dy: number): PenPoint[] {
  return pts.map((p, idx) => {
    if (idx !== i) return p
    const q: PenPoint = { x: p.x + dx, y: p.y + dy }
    if (p.hix != null && p.hiy != null) { q.hix = p.hix + dx; q.hiy = p.hiy + dy }
    if (p.hox != null && p.hoy != null) { q.hox = p.hox + dx; q.hoy = p.hoy + dy }
    return q
  })
}

/**
 * Setel salah satu handle anchor ke-i ke titik (hx,hy). Pasangannya dicermin
 * melewati anchor (mulus simetris) — inilah perilaku bawaan editor bezier.
 */
export function setHandle(pts: PenPoint[], i: number, sisi: 'in' | 'out', hx: number, hy: number): PenPoint[] {
  return pts.map((p, idx) => {
    if (idx !== i) return p
    const q: PenPoint = { ...p }
    if (sisi === 'out') {
      q.hox = hx; q.hoy = hy
      q.hix = 2 * p.x - hx; q.hiy = 2 * p.y - hy
    } else {
      q.hix = hx; q.hiy = hy
      q.hox = 2 * p.x - hx; q.hoy = 2 * p.y - hy
    }
    return q
  })
}

/** Hapus anchor ke-i. */
export function hapusAnchor(pts: PenPoint[], i: number): PenPoint[] {
  return pts.filter((_, idx) => idx !== i)
}

/** Indeks anchor pasangan sebuah ruas yang dimulai di segIdx (−1 bila tak ada). */
function ruasBerikut(pts: PenPoint[], segIdx: number, closed: boolean): number {
  if (segIdx + 1 < pts.length) return segIdx + 1
  return closed ? 0 : -1
}

/**
 * Titik di TENGAH kurva (t=0.5) ruas segIdx→berikutnya, dihitung dengan
 * de Casteljau (rata-rata titik tengah — eksak, tanpa penyelesaian numerik).
 * Dipakai untuk menaruh penanda "tambah titik".
 */
export function titikTengahRuas(pts: PenPoint[], segIdx: number, closed: boolean): { x: number; y: number } | null {
  const j = ruasBerikut(pts, segIdx, closed)
  if (j < 0) return null
  const A = pts[segIdx], B = pts[j]
  const p1x = A.hox ?? A.x, p1y = A.hoy ?? A.y
  const p2x = B.hix ?? B.x, p2y = B.hiy ?? B.y
  const q0x = (A.x + p1x) / 2, q0y = (A.y + p1y) / 2
  const q1x = (p1x + p2x) / 2, q1y = (p1y + p2y) / 2
  const q2x = (p2x + B.x) / 2, q2y = (p2y + B.y) / 2
  const r0x = (q0x + q1x) / 2, r0y = (q0y + q1y) / 2
  const r1x = (q1x + q2x) / 2, r1y = (q1y + q2y) / 2
  return { x: (r0x + r1x) / 2, y: (r0y + r1y) / 2 }
}

/**
 * Sisipkan anchor di tengah ruas segIdx→berikutnya, memecah bezier di t=0.5
 * dengan de Casteljau — bentuk kurva TIDAK berubah. Ruas lurus mendapat titik
 * sudut biasa di tengah.
 */
export function sisipTitik(pts: PenPoint[], segIdx: number, closed: boolean): PenPoint[] {
  const j = ruasBerikut(pts, segIdx, closed)
  if (j < 0) return pts
  const A = pts[segIdx], B = pts[j]
  const outAda = A.hox != null && A.hoy != null
  const inAda = B.hix != null && B.hiy != null
  const hasil = pts.slice()

  if (!outAda && !inAda) {
    // Ruas lurus → titik sudut di tengah; A & B tetap sudut.
    hasil.splice(segIdx + 1, 0, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 })
    return hasil
  }

  const p1x = outAda ? (A.hox as number) : A.x, p1y = outAda ? (A.hoy as number) : A.y
  const p2x = inAda ? (B.hix as number) : B.x, p2y = inAda ? (B.hiy as number) : B.y
  const q0x = (A.x + p1x) / 2, q0y = (A.y + p1y) / 2
  const q1x = (p1x + p2x) / 2, q1y = (p1y + p2y) / 2
  const q2x = (p2x + B.x) / 2, q2y = (p2y + B.y) / 2
  const r0x = (q0x + q1x) / 2, r0y = (q0y + q1y) / 2
  const r1x = (q1x + q2x) / 2, r1y = (q1y + q2y) / 2
  const sx = (r0x + r1x) / 2, sy = (r0y + r1y) / 2

  hasil[segIdx] = { ...A, hox: q0x, hoy: q0y }
  hasil[j] = { ...B, hix: q2x, hiy: q2y }
  hasil.splice(segIdx + 1, 0, { x: sx, y: sy, hix: r0x, hiy: r0y, hox: r1x, hoy: r1y })
  return hasil
}

/**
 * Ubah anchor ke-i: mulus→sudut (buang handle) atau sudut→mulus (pasang handle
 * simetris searah singgung dari tetangganya).
 */
export function toggleTitik(pts: PenPoint[], i: number, closed: boolean): PenPoint[] {
  const cur = pts[i]
  const mulus = cur.hox != null || cur.hix != null
  return pts.map((q, idx) => {
    if (idx !== i) return q
    if (mulus) return { x: q.x, y: q.y } // jadi sudut

    const prevI = i > 0 ? i - 1 : (closed ? pts.length - 1 : -1)
    const nextI = i < pts.length - 1 ? i + 1 : (closed ? 0 : -1)
    let dx = 0, dy = 0, len = 30
    if (prevI >= 0 && nextI >= 0 && prevI !== i && nextI !== i) {
      const pr = pts[prevI], nx = pts[nextI]
      dx = nx.x - pr.x; dy = nx.y - pr.y
      len = Math.max(8, Math.min(Math.hypot(q.x - pr.x, q.y - pr.y), Math.hypot(q.x - nx.x, q.y - nx.y)) / 3)
    } else if (nextI >= 0 && nextI !== i) {
      dx = pts[nextI].x - q.x; dy = pts[nextI].y - q.y
      len = Math.max(8, Math.hypot(dx, dy) / 3)
    } else if (prevI >= 0 && prevI !== i) {
      dx = q.x - pts[prevI].x; dy = q.y - pts[prevI].y
      len = Math.max(8, Math.hypot(dx, dy) / 3)
    }
    const m = Math.hypot(dx, dy) || 1
    const ux = dx / m, uy = dy / m
    return { x: q.x, y: q.y, hox: q.x + ux * len, hoy: q.y + uy * len, hix: q.x - ux * len, hiy: q.y - uy * len }
  })
}

/** Memutar sebuah TITIK di sekitar pusat (cx,cy). Untuk sunting node berotasi. */
export function putarTitik(x: number, y: number, cx: number, cy: number, deg: number): { x: number; y: number } {
  if (!deg) return { x, y }
  const r = (deg * Math.PI) / 180
  const dx = x - cx
  const dy = y - cy
  return {
    x: cx + dx * Math.cos(r) - dy * Math.sin(r),
    y: cy + dx * Math.sin(r) + dy * Math.cos(r),
  }
}
