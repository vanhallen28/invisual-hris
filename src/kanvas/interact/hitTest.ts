import type { SceneNode } from '@/kanvas/doc/types'
import { titikBangun, titikDiDalam } from '@/kanvas/doc/polygon'

const AMBANG_GARIS = 5

/** Memutar balik titik ke ruang lokal node yang belum berotasi. */
function keRuangLokal(node: SceneNode, worldX: number, worldY: number) {
  if (!node.rotation) return { x: worldX, y: worldY }

  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  const rad = (-node.rotation * Math.PI) / 180
  const dx = worldX - cx
  const dy = worldY - cy

  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

function jarakKeSegmen(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const panjangKuadrat = dx * dx + dy * dy
  if (panjangKuadrat === 0) return Math.hypot(px - ax, py - ay)

  let t = ((px - ax) * dx + (py - ay) * dy) / panjangKuadrat
  t = Math.max(0, Math.min(1, t))

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function hitsNode(node: SceneNode, worldX: number, worldY: number): boolean {
  if (!node.visible || node.locked) return false
  // Group dipilih lewat anaknya, bukan langsung.
  if (node.type === 'group') return false

  const p = keRuangLokal(node, worldX, worldY)

  if (node.type === 'ellipse') {
    const rx = node.w / 2
    const ry = node.h / 2
    if (rx === 0 || ry === 0) return false
    const nx = (p.x - (node.x + rx)) / rx
    const ny = (p.y - (node.y + ry)) / ry
    return nx * nx + ny * ny <= 1
  }

  // Poligon dan bintang diuji terhadap bangunnya sendiri, bukan kotak
  // pembatas. Sudut kosong di sekitar segitiga tidak boleh ikut terpilih.
  if (node.type === 'polygon' || node.type === 'star') {
    return titikDiDalam(titikBangun(node), p.x, p.y)
  }

  // Panah diperlakukan sama seperti garis: yang dihitung jarak ke
  // segmennya, bukan kotak pembatas. Kalau memakai kotak, mengklik
  // ruang kosong di dekat panah diagonal akan ikut memilihnya.
  if (node.type === 'line' || node.type === 'arrow') {
    const ambang = Math.max(AMBANG_GARIS, node.strokeWidth / 2)
    return (
      jarakKeSegmen(p.x, p.y, node.x, node.y, node.x + node.w, node.y + node.h) <= ambang
    )
  }

  return p.x >= node.x && p.x <= node.x + node.w && p.y >= node.y && p.y <= node.y + node.h
}

/** `nodes` diharapkan terurut bawah ke atas, seperti readAllNodes. */
export function topmostAt(
  nodes: SceneNode[],
  worldX: number,
  worldY: number
): SceneNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (hitsNode(nodes[i], worldX, worldY)) return nodes[i]
  }
  return null
}
