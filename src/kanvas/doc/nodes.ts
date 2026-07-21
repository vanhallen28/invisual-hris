import * as Y from 'yjs'
import { nodesMap } from './doc'
import { keyAfter, sortByOrder } from './order'
import { DEFAULTS, DEFAULT_NAME, type NodeInit, type SceneNode, type YNode } from './types'

function lastOrderIn(doc: Y.Doc, parent: string): string | null {
  const saudara = readAllNodes(doc).filter((n) => n.parent === parent)
  if (saudara.length === 0) return null
  return saudara[saudara.length - 1].order
}

export function createNode(doc: Y.Doc, init: NodeInit): string {
  const id = crypto.randomUUID()
  const parent = init.parent ?? DEFAULTS.parent

  const isi: Record<string, unknown> = {
    ...DEFAULTS,
    name: DEFAULT_NAME[init.type],
    ...init,
    parent,
    order: keyAfter(lastOrderIn(doc, parent)),
  }

  doc.transact(() => {
    // Wajib Y.Map. Objek JS biasa akan menjadikan seluruh node
    // satu nilai LWW dan mematikan penggabungan per-properti.
    const node: YNode = new Y.Map()
    for (const [kunci, nilai] of Object.entries(isi)) {
      if (nilai !== undefined) node.set(kunci, nilai)
    }
    nodesMap(doc).set(id, node)
  }, 'local')

  return id
}

export function readNode(doc: Y.Doc, id: string): SceneNode | null {
  const node = nodesMap(doc).get(id)
  if (!node) return null
  return { ...(node.toJSON() as Omit<SceneNode, 'id'>), id }
}

export function readAllNodes(doc: Y.Doc): SceneNode[] {
  const keluar: SceneNode[] = []
  nodesMap(doc).forEach((node, id) => {
    keluar.push({ ...(node.toJSON() as Omit<SceneNode, 'id'>), id })
  })
  return sortByOrder(keluar)
}

export function updateNode(doc: Y.Doc, id: string, patch: Partial<SceneNode>): void {
  const node = nodesMap(doc).get(id)
  if (!node) return

  doc.transact(() => {
    for (const [kunci, nilai] of Object.entries(patch)) {
      if (kunci === 'id') continue
      if (nilai === undefined) continue
      node.set(kunci, nilai)
    }
  }, 'local')
}

export function deleteNode(doc: Y.Doc, id: string): void {
  const semua = readAllNodes(doc)

  const terkumpul = new Set<string>([id])
  let bertambah = true
  while (bertambah) {
    bertambah = false
    for (const n of semua) {
      if (!terkumpul.has(n.id) && terkumpul.has(n.parent)) {
        terkumpul.add(n.id)
        bertambah = true
      }
    }
  }

  doc.transact(() => {
    for (const target of terkumpul) nodesMap(doc).delete(target)
  }, 'local')
}
