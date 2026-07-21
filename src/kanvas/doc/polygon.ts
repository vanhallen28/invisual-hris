import type { SceneNode } from './types'

/**
 * Titik-titik poligon dan bintang.
 *
 * Keduanya dihitung dari kotak pembatas node, bukan disimpan sebagai
 * daftar titik. Artinya menyeret gagang ukuran langsung membentuk ulang
 * bangunnya, dan jumlah sisi bisa diubah kapan saja tanpa kehilangan
 * posisi — hal yang tidak mungkin kalau titiknya dibekukan saat dibuat.
 *
 * Perender dan uji-sentuh memakai fungsi yang sama supaya bentuk yang
 * terlihat dan area yang bisa diklik tidak pernah berbeda.
 */

export const SISI_MIN = 3
export const SISI_MAKS = 24
export const SISI_BAWAAN = 3          // segitiga, seperti kebiasaan editor grafis
export const TITIK_BINTANG_BAWAAN = 5

/** Seberapa dalam lekukan bintang. 0,382 mendekati bintang lima klasik. */
const RASIO_DALAM = 0.382

export function jumlahSisi(node: Pick<SceneNode, 'type' | 'sides'>): number {
  const bawaan = node.type === 'star' ? TITIK_BINTANG_BAWAAN : SISI_BAWAAN
  const n = Math.round(Number(node.sides ?? bawaan))
  if (!Number.isFinite(n)) return bawaan
  return Math.min(SISI_MAKS, Math.max(SISI_MIN, n))
}

export type Titik = { x: number; y: number }

/** Titik-titik dalam koordinat dunia, mengikuti kotak pembatas node. */
export function titikBangun(
  node: Pick<SceneNode, 'type' | 'sides' | 'x' | 'y' | 'w' | 'h'>
): Titik[] {
  const n = jumlahSisi(node)
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  const rx = node.w / 2
  const ry = node.h / 2

  // Mulai dari atas: -90 derajat. Tanpa ini segitiga akan miring
  // dan terlihat seperti kesalahan, bukan pilihan.
  const awal = -Math.PI / 2
  const keluar: Titik[] = []

  if (node.type === 'star') {
    const langkah = Math.PI / n            // selang-seling luar-dalam
    for (let i = 0; i < n * 2; i++) {
      const luar = i % 2 === 0
      const skala = luar ? 1 : RASIO_DALAM
      const a = awal + i * langkah
      keluar.push({ x: cx + Math.cos(a) * rx * skala, y: cy + Math.sin(a) * ry * skala })
    }
    return keluar
  }

  const langkah = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const a = awal + i * langkah
    keluar.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })
  }
  return keluar
}

/** Format `points` untuk elemen <polygon> SVG. */
export function titikKeSvg(titik: Titik[]): string {
  return titik.map((t) => `${t.x},${t.y}`).join(' ')
}

/**
 * Uji titik di dalam poligon dengan metode ray casting.
 * Dipakai agar mengklik sudut kosong kotak pembatas segitiga tidak
 * ikut memilihnya.
 */
export function titikDiDalam(titik: Titik[], px: number, py: number): boolean {
  let di = false
  for (let i = 0, j = titik.length - 1; i < titik.length; j = i++) {
    const { x: xi, y: yi } = titik[i]
    const { x: xj, y: yj } = titik[j]
    const memotong = yi > py !== yj > py
    if (memotong && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) di = !di
  }
  return di
}
