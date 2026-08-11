import * as Y from 'yjs'
import { nodesMap } from './doc'
import { keyAfter } from './order'
import { DEFAULTS, DEFAULT_NAME, ROOT, type NodeInit, type SceneNode, type YNode } from './types'

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

/**
 * Urutan HIERARKIS untuk render & hit-test: induk lalu anak-anaknya, sehingga
 * ANAK selalu "di atas" induknya. Saudara diurutkan berdasarkan order key.
 * Penting agar objek di dalam Frame bisa diklik/dipilih (tak tertutup frame)
 * dan frame tak menutupi isinya.
 */
function sortHierarki(nodes: SceneNode[]): SceneNode[] {
  const anak = new Map<string, SceneNode[]>()
  for (const n of nodes) {
    const p = n.parent ?? ROOT
    if (!anak.has(p)) anak.set(p, [])
    anak.get(p)!.push(n)
  }
  for (const arr of anak.values()) {
    arr.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
  }
  const keluar: SceneNode[] = []
  const dilihat = new Set<string>()
  const telusuri = (p: string) => {
    for (const n of anak.get(p) ?? []) {
      if (dilihat.has(n.id)) continue
      dilihat.add(n.id)
      keluar.push(n)
      telusuri(n.id)
    }
  }
  telusuri(ROOT)
  // Node yatim (induknya tak ada) tetap disertakan di akhir agar tak hilang.
  for (const n of nodes) if (!dilihat.has(n.id)) keluar.push(n)
  return keluar
}

export function readAllNodes(doc: Y.Doc): SceneNode[] {
  const keluar: SceneNode[] = []
  nodesMap(doc).forEach((node, id) => {
    keluar.push({ ...(node.toJSON() as Omit<SceneNode, 'id'>), id })
  })
  return sortHierarki(keluar)
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

/**
 * Menghapus SATU properti dari sebuah node. `updateNode` hanya bisa menetapkan
 * nilai, tidak menghapus kunci — ini dipakai untuk "membatalkan potong": crop
 * harus benar-benar TIDAK ADA agar gambar kembali ke render penuh (menyetel
 * ke nilai identitas tidak cukup karena render membedakan ada/tidaknya crop).
 */
export function hapusFieldNode(doc: Y.Doc, id: string, kunci: string): void {
  const node = nodesMap(doc).get(id)
  if (!node) return
  doc.transact(() => {
    node.delete(kunci)
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
