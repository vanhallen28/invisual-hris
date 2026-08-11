// src/kanvas/lib/svgKeNode.ts
//
// Konversi berkas SVG → node vektor kanvas (v1). Dijalankan di browser
// (memakai DOMParser). Menangani elemen umum:
//   path (M/m L/l H/h V/v C/c Q/q Z/z; S/T/A didekati), rect, circle,
//   ellipse, line, polyline, polygon — beserta fill/stroke/stroke-width.
//
// BATAS v1: transform pada elemen/grup, gradient/pattern, clip/mask, dan
// arc (A) yang presisi BELUM didukung — SVG rumit mungkin tak sempurna.

import type { NodeInit, PenPoint } from '@/kanvas/doc/types'

type Titik = { x: number; y: number }

/** Pecah string angka path jadi array number (menangani '-', '.', dan ',' rapat). */
function angka(s: string): number[] {
  const keluar: number[] = []
  const re = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) keluar.push(parseFloat(m[0]))
  return keluar
}

/** Pisah 'd' jadi segmen [huruf, angka[]]. */
function segmenD(d: string): Array<[string, number[]]> {
  const keluar: Array<[string, number[]]> = []
  const re = /([a-df-z])([^a-df-z]*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) keluar.push([m[1], angka(m[2])])
  return keluar
}

/** Ubah satu 'd' jadi kumpulan sub-jalur PenPoint. Tiap M memulai sub-jalur. */
function jalurDariD(d: string): Array<{ pts: PenPoint[]; closed: boolean }> {
  const hasil: Array<{ pts: PenPoint[]; closed: boolean }> = []
  let pts: PenPoint[] = []
  let cur: Titik = { x: 0, y: 0 }
  let mulai: Titik = { x: 0, y: 0 }
  let closed = false

  const dorongSub = () => {
    if (pts.length >= 2) hasil.push({ pts, closed })
    pts = []
    closed = false
  }

  for (const [huruf, n] of segmenD(d)) {
    const rel = huruf === huruf.toLowerCase()
    const H = huruf.toUpperCase()
    let i = 0
    const bacaX = (v: number) => (rel ? cur.x + v : v)
    const bacaY = (v: number) => (rel ? cur.y + v : v)

    if (H === 'M') {
      // M memulai sub-jalur baru.
      dorongSub()
      const x = bacaX(n[i++]), y = bacaY(n[i++])
      cur = { x, y }; mulai = { x, y }
      pts.push({ x, y })
      // pasangan berikutnya di M dianggap L
      while (i + 1 < n.length) {
        const lx = rel ? cur.x + n[i++] : n[i++]
        const ly = rel ? cur.y + n[i++] : n[i++]
        cur = { x: lx, y: ly }
        pts.push({ x: lx, y: ly })
      }
    } else if (H === 'L') {
      while (i + 1 < n.length) {
        const x = rel ? cur.x + n[i++] : n[i++]
        const y = rel ? cur.y + n[i++] : n[i++]
        cur = { x, y }
        pts.push({ x, y })
      }
    } else if (H === 'H') {
      while (i < n.length) {
        const x = rel ? cur.x + n[i++] : n[i++]
        cur = { x, y: cur.y }
        pts.push({ x, y: cur.y })
      }
    } else if (H === 'V') {
      while (i < n.length) {
        const y = rel ? cur.y + n[i++] : n[i++]
        cur = { x: cur.x, y }
        pts.push({ x: cur.x, y })
      }
    } else if (H === 'C') {
      while (i + 5 < n.length) {
        const x1 = bacaX(n[i++]), y1 = bacaY(n[i++])
        const x2 = bacaX(n[i++]), y2 = bacaY(n[i++])
        const x = bacaX(n[i++]), y = bacaY(n[i++])
        const prev = pts[pts.length - 1]
        if (prev) { prev.hox = x1; prev.hoy = y1 }
        pts.push({ x, y, hix: x2, hiy: y2 })
        cur = { x, y }
      }
    } else if (H === 'S') {
      // Cubic mulus: handle keluar sebelumnya dicerminkan sebagai handle masuk.
      while (i + 3 < n.length) {
        const x2 = bacaX(n[i++]), y2 = bacaY(n[i++])
        const x = bacaX(n[i++]), y = bacaY(n[i++])
        const prev = pts[pts.length - 1]
        if (prev && prev.hox != null && prev.hoy != null) {
          // tidak diubah; hanya set handle masuk titik baru
        }
        pts.push({ x, y, hix: x2, hiy: y2 })
        cur = { x, y }
      }
    } else if (H === 'Q') {
      // Kuadratik → cubic (kontrol 2/3 menuju titik kontrol dari tiap ujung).
      while (i + 3 < n.length) {
        const qx = bacaX(n[i++]), qy = bacaY(n[i++])
        const x = bacaX(n[i++]), y = bacaY(n[i++])
        const prev = pts[pts.length - 1]
        if (prev) {
          prev.hox = prev.x + (2 / 3) * (qx - prev.x)
          prev.hoy = prev.y + (2 / 3) * (qy - prev.y)
        }
        pts.push({ x, y, hix: x + (2 / 3) * (qx - x), hiy: y + (2 / 3) * (qy - y) })
        cur = { x, y }
      }
    } else if (H === 'T') {
      while (i + 1 < n.length) {
        const x = bacaX(n[i++]), y = bacaY(n[i++])
        pts.push({ x, y })
        cur = { x, y }
      }
    } else if (H === 'A') {
      // Arc didekati sebagai garis ke titik ujung (v1).
      while (i + 6 < n.length) {
        i += 5
        const x = bacaX(n[i++]), y = bacaY(n[i++])
        pts.push({ x, y })
        cur = { x, y }
      }
    } else if (H === 'Z') {
      closed = true
      cur = { ...mulai }
    }
  }
  dorongSub()
  return hasil
}

/** bbox dari titik-titik PenPoint (anchor + handle). */
function bboxPts(pts: PenPoint[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const c = (x: number, y: number) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  for (const p of pts) {
    c(p.x, p.y)
    if (p.hix != null && p.hiy != null) c(p.hix, p.hiy)
    if (p.hox != null && p.hoy != null) c(p.hox, p.hoy)
  }
  return { minX, minY, maxX, maxY }
}

/** Ambil gaya (fill/stroke) dari sebuah elemen SVG. */
function gaya(el: Element): { fill: string; stroke: string; strokeWidth: number } {
  const attr = (k: string) => el.getAttribute(k) || ''
  const gayaInline = attr('style')
  const dariStyle = (k: string) => {
    const m = new RegExp(`${k}\\s*:\\s*([^;]+)`, 'i').exec(gayaInline)
    return m ? m[1].trim() : ''
  }
  let fill = attr('fill') || dariStyle('fill') || '#d4d4d8'
  let stroke = attr('stroke') || dariStyle('stroke') || 'transparent'
  if (fill === 'none') fill = 'transparent'
  if (stroke === 'none') stroke = 'transparent'
  const swRaw = attr('stroke-width') || dariStyle('stroke-width')
  const strokeWidth = swRaw ? parseFloat(swRaw) || 1 : 1
  return { fill, stroke, strokeWidth }
}

const num = (el: Element, k: string, d = 0) => {
  const v = parseFloat(el.getAttribute(k) || '')
  return Number.isFinite(v) ? v : d
}

/**
 * Ubah teks SVG jadi daftar NodeInit vektor, sudah digeser sebesar (dx,dy).
 * Skala 1:1 dengan koordinat SVG (pengguna bisa resize setelahnya).
 */
export function svgKeNodeInit(svgText: string, dx: number, dy: number): NodeInit[] {
  let dokumen: Document
  try {
    dokumen = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  } catch {
    return []
  }
  const svg = dokumen.querySelector('svg')
  if (!svg) return []

  const keluar: NodeInit[] = []
  const els = svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon')

  els.forEach((el) => {
    const g = gaya(el)
    const tag = el.tagName.toLowerCase()

    if (tag === 'path') {
      const d = el.getAttribute('d') || ''
      for (const sub of jalurDariD(d)) {
        const b = bboxPts(sub.pts)
        if (!Number.isFinite(b.minX)) continue
        keluar.push({
          type: 'pen',
          x: b.minX + dx, y: b.minY + dy,
          w: Math.max(1, b.maxX - b.minX), h: Math.max(1, b.maxY - b.minY),
          path: { pts: sub.pts.map((p) => ({
            x: p.x + dx, y: p.y + dy,
            hix: p.hix != null ? p.hix + dx : undefined, hiy: p.hiy != null ? p.hiy + dy : undefined,
            hox: p.hox != null ? p.hox + dx : undefined, hoy: p.hoy != null ? p.hoy + dy : undefined,
          })), closed: sub.closed },
          fill: sub.closed ? g.fill : 'transparent',
          stroke: g.stroke !== 'transparent' ? g.stroke : (sub.closed ? 'transparent' : '#111827'),
          strokeWidth: g.strokeWidth,
        })
      }
    } else if (tag === 'rect') {
      keluar.push({
        type: 'rect',
        x: num(el, 'x') + dx, y: num(el, 'y') + dy,
        w: Math.max(1, num(el, 'width')), h: Math.max(1, num(el, 'height')),
        radius: num(el, 'rx') || undefined,
        fill: g.fill, stroke: g.stroke, strokeWidth: g.strokeWidth,
      })
    } else if (tag === 'circle') {
      const r = num(el, 'r')
      keluar.push({
        type: 'ellipse',
        x: num(el, 'cx') - r + dx, y: num(el, 'cy') - r + dy,
        w: Math.max(1, 2 * r), h: Math.max(1, 2 * r),
        fill: g.fill, stroke: g.stroke, strokeWidth: g.strokeWidth,
      })
    } else if (tag === 'ellipse') {
      const rx = num(el, 'rx'), ry = num(el, 'ry')
      keluar.push({
        type: 'ellipse',
        x: num(el, 'cx') - rx + dx, y: num(el, 'cy') - ry + dy,
        w: Math.max(1, 2 * rx), h: Math.max(1, 2 * ry),
        fill: g.fill, stroke: g.stroke, strokeWidth: g.strokeWidth,
      })
    } else if (tag === 'line') {
      const x1 = num(el, 'x1'), y1 = num(el, 'y1'), x2 = num(el, 'x2'), y2 = num(el, 'y2')
      keluar.push({
        type: 'line',
        x: x1 + dx, y: y1 + dy, w: x2 - x1, h: y2 - y1,
        stroke: g.stroke !== 'transparent' ? g.stroke : '#111827', strokeWidth: g.strokeWidth,
      })
    } else if (tag === 'polyline' || tag === 'polygon') {
      const koord = angka(el.getAttribute('points') || '')
      const pts: PenPoint[] = []
      for (let k = 0; k + 1 < koord.length; k += 2) pts.push({ x: koord[k], y: koord[k + 1] })
      if (pts.length < 2) return
      const b = bboxPts(pts)
      keluar.push({
        type: 'pen',
        x: b.minX + dx, y: b.minY + dy,
        w: Math.max(1, b.maxX - b.minX), h: Math.max(1, b.maxY - b.minY),
        path: { pts: pts.map((p) => ({ x: p.x + dx, y: p.y + dy })), closed: tag === 'polygon' },
        fill: tag === 'polygon' ? g.fill : 'transparent',
        stroke: g.stroke !== 'transparent' ? g.stroke : (tag === 'polygon' ? 'transparent' : '#111827'),
        strokeWidth: g.strokeWidth,
      })
    }
  })

  return keluar
}
