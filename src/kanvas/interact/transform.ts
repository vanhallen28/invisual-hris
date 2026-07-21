import type { SceneNode } from '@/kanvas/doc/types'

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export type Box = { x: number; y: number; w: number; h: number }

const UKURAN_MIN = 1
const SNAP_DERAJAT = 15

export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  deg: number
): { x: number; y: number } {
  if (!deg) return { x: px, y: py }
  const rad = (deg * Math.PI) / 180
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

export function moveBy(node: SceneNode, dxWorld: number, dyWorld: number): Box {
  return { x: node.x + dxWorld, y: node.y + dyWorld, w: node.w, h: node.h }
}

export function resizeFrom(
  node: SceneNode,
  handle: Handle,
  pointerWorldX: number,
  pointerWorldY: number,
  proporsional = false
): Box {
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2

  const kiri = node.x
  const atas = node.y
  const kanan = node.x + node.w
  const bawah = node.y + node.h

  const geserKiri = handle.includes('w')
  const geserKanan = handle.includes('e')
  const geserAtas = handle.includes('n')
  const geserBawah = handle.includes('s')

  // Pointer diputar balik ke ruang lokal node, di sekitar pusatnya
  // yang sekarang. Setelah ini seluruh perhitungan jadi sejajar sumbu.
  const p = rotatePoint(pointerWorldX, pointerWorldY, cx, cy, -node.rotation)

  let kiriAkhir = geserKiri ? p.x : kiri
  let kananAkhir = geserKanan ? p.x : kanan
  let atasAkhir = geserAtas ? p.y : atas
  let bawahAkhir = geserBawah ? p.y : bawah

  // Handle sisi hanya punya satu sumbu bebas; memaksakan rasio
  // di sana membuat objek melompat begitu Shift ditekan.
  const sudut = geserKiri !== geserKanan && geserAtas !== geserBawah
  if (proporsional && sudut && node.h !== 0) {
    const rasio = node.w / node.h
    const lebar = Math.abs(kananAkhir - kiriAkhir)
    const tinggi = Math.abs(bawahAkhir - atasAkhir)

    // Sisi yang bergerak paling jauh yang menentukan, supaya
    // gerakan terasa mengikuti tangan, bukan dirata-ratakan.
    const pakaiLebar = lebar / rasio >= tinggi
    const lebarBaru = pakaiLebar ? lebar : tinggi * rasio
    const tinggiBaru = pakaiLebar ? lebar / rasio : tinggi

    if (geserKiri) kiriAkhir = kananAkhir - lebarBaru
    else kananAkhir = kiriAkhir + lebarBaru

    if (geserAtas) atasAkhir = bawahAkhir - tinggiBaru
    else bawahAkhir = atasAkhir + tinggiBaru
  }

  let x = Math.min(kiriAkhir, kananAkhir)
  let y = Math.min(atasAkhir, bawahAkhir)
  const w = Math.max(UKURAN_MIN, Math.abs(kananAkhir - kiriAkhir))
  const h = Math.max(UKURAN_MIN, Math.abs(bawahAkhir - atasAkhir))

  // Titik jangkar: sudut yang tidak ikut bergerak, dalam ruang lokal.
  const jangkarX = geserKiri ? kanan : kiri
  const jangkarY = geserAtas ? bawah : atas

  // Tanpa koreksi berikut, pusat berpindah, dan karena rotasi
  // terjadi di sekitar pusat, jangkar ikut melayang di ruang dunia.
  const jangkarDunia = rotatePoint(jangkarX, jangkarY, cx, cy, node.rotation)
  const jangkarBaru = rotatePoint(jangkarX, jangkarY, x + w / 2, y + h / 2, node.rotation)

  x += jangkarDunia.x - jangkarBaru.x
  y += jangkarDunia.y - jangkarBaru.y

  return { x, y, w, h }
}

export function rotateTo(
  node: SceneNode,
  pointerWorldX: number,
  pointerWorldY: number,
  snap: boolean
): number {
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2

  // +90 karena handle rotasi berada di atas node: menunjuk ke atas
  // harus berarti nol derajat.
  const mentah = (Math.atan2(pointerWorldY - cy, pointerWorldX - cx) * 180) / Math.PI + 90
  const dinormalkan = ((mentah % 360) + 360) % 360

  if (!snap) return dinormalkan
  return (Math.round(dinormalkan / SNAP_DERAJAT) * SNAP_DERAJAT) % 360
}
