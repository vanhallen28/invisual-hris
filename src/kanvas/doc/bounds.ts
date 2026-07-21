import type * as Y from 'yjs'
import { childrenOf } from './hierarchy'
import { readNode } from './nodes'

export type Rect = { x: number; y: number; w: number; h: number }

export function boundsOf(doc: Y.Doc, id: string): Rect | null {
  const node = readNode(doc, id)
  if (!node) return null

  if (node.type !== 'group') {
    return { x: node.x, y: node.y, w: node.w, h: node.h }
  }

  // Group tidak menyimpan geometri sendiri; batasnya adalah
  // gabungan batas anak-anaknya, dihitung rekursif.
  const kotakAnak = childrenOf(doc, id)
    .map((anak) => boundsOf(doc, anak.id))
    .filter((r): r is Rect => r !== null)

  if (kotakAnak.length === 0) return null

  const kiri = Math.min(...kotakAnak.map((r) => r.x))
  const atas = Math.min(...kotakAnak.map((r) => r.y))
  const kanan = Math.max(...kotakAnak.map((r) => r.x + r.w))
  const bawah = Math.max(...kotakAnak.map((r) => r.y + r.h))

  return { x: kiri, y: atas, w: kanan - kiri, h: bawah - atas }
}
