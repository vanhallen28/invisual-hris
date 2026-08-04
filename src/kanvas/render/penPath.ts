import type { PenPoint } from '@/kanvas/doc/types'

const bulat = (n: number) => Math.round(n * 100) / 100

/**
 * Membangun atribut `d` sebuah <path> bezier dari deretan anchor Pen.
 *
 * `map` memetakan sebuah titik ruang-sumber ke ruang keluaran — dipakai bersama
 * oleh render node (peta = skala ke kotak node) dan pratinjau saat menggambar
 * (peta = dunia→layar), jadi rumus bezier tidak digandakan.
 *
 * Tiap ruas dipakai perintah C (kubik). Bila sebuah sisi tak punya handle,
 * titik kontrolnya jatuh ke anchor itu sendiri — yang membuat C berperilaku
 * sebagai garis lurus. Jadi sudut dan lengkung ditangani seragam.
 */
export function dJalurPen(
  pts: PenPoint[],
  closed: boolean,
  map: (x: number, y: number) => { x: number; y: number },
): string {
  if (pts.length === 0) return ''
  const M = map(pts[0].x, pts[0].y)
  let d = `M${bulat(M.x)} ${bulat(M.y)}`

  const ruas = (a: PenPoint, b: PenPoint) => {
    const c1 = map(a.hox ?? a.x, a.hoy ?? a.y)
    const c2 = map(b.hix ?? b.x, b.hiy ?? b.y)
    const p = map(b.x, b.y)
    return ` C${bulat(c1.x)} ${bulat(c1.y)} ${bulat(c2.x)} ${bulat(c2.y)} ${bulat(p.x)} ${bulat(p.y)}`
  }

  for (let i = 0; i < pts.length - 1; i++) d += ruas(pts[i], pts[i + 1])
  if (closed && pts.length >= 2) {
    d += ruas(pts[pts.length - 1], pts[0])
    d += ' Z'
  }
  return d
}
