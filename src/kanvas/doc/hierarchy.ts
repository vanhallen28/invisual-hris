import type * as Y from 'yjs'
import { createNode, deleteNode, readAllNodes, readNode, updateNode } from './nodes'
import { keyAfter, keysBetween, sortByOrder } from './order'
import { ROOT, type SceneNode } from './types'

export function childrenOf(doc: Y.Doc, parentId: string): SceneNode[] {
  return sortByOrder(readAllNodes(doc).filter((n) => n.parent === parentId))
}

function isDescendant(semua: SceneNode[], calonAnak: string, calonInduk: string): boolean {
  const indukDari = new Map(semua.map((n) => [n.id, n.parent]))
  let kursor: string | undefined = calonAnak
  while (kursor && kursor !== ROOT) {
    if (kursor === calonInduk) return true
    kursor = indukDari.get(kursor)
  }
  return false
}

export function reparent(doc: Y.Doc, id: string, newParent: string): void {
  const semua = readAllNodes(doc)

  // Tanpa penjagaan ini, memindahkan frame ke dalam anaknya sendiri
  // memutus subtree itu dari root: node-nya tetap ada tapi tidak
  // pernah ter-render, dan tidak ada cara memilihnya kembali.
  if (newParent !== ROOT && isDescendant(semua, newParent, id)) {
    throw new Error('Pemindahan ditolak: akan membentuk siklus')
  }

  const saudara = semua.filter((n) => n.parent === newParent && n.id !== id)
  const terakhir = saudara.length > 0 ? saudara[saudara.length - 1].order : null

  updateNode(doc, id, { parent: newParent, order: keyAfter(terakhir) })
}

export function groupNodes(doc: Y.Doc, ids: string[]): string | null {
  if (ids.length < 2) return null

  const anggota = ids.map((id) => readNode(doc, id)).filter((n): n is SceneNode => n !== null)
  if (anggota.length !== ids.length) return null

  const induk = anggota[0].parent
  if (anggota.some((n) => n.parent !== induk)) return null

  const grup = createNode(doc, { type: 'group', parent: induk })

  for (const n of sortByOrder(anggota)) {
    reparent(doc, n.id, grup)
  }

  return grup
}

export function ungroup(doc: Y.Doc, groupId: string): void {
  const grup = readNode(doc, groupId)
  if (!grup || grup.type !== 'group') return

  const anak = childrenOf(doc, groupId)
  if (anak.length > 0) {
    const saudara = readAllNodes(doc).filter(
      (n) => n.parent === grup.parent && n.id !== groupId
    )
    const sesudah = saudara.filter((n) => n.order > grup.order)
    const batasAtas = sesudah.length > 0 ? sesudah[0].order : null
    const kunci = keysBetween(grup.order, batasAtas, anak.length)

    anak.forEach((n, i) => {
      updateNode(doc, n.id, { parent: grup.parent, order: kunci[i] })
    })
  }

  deleteNode(doc, groupId)
}
