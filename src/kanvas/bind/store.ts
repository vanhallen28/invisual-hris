import * as Y from 'yjs'
import { nodesMap } from '@/kanvas/doc/doc'
import { readAllNodes, readNode } from '@/kanvas/doc/nodes'
import type { SceneNode } from '@/kanvas/doc/types'

export type Unsubscribe = () => void

export interface DocStore {
  /** Pasang kembali observer setelah destroy. Dipakai React StrictMode. */
  pasangUlang: () => void
  subscribeIds(cb: () => void): Unsubscribe
  getIds(): string[]
  subscribeNode(id: string, cb: () => void): Unsubscribe
  getNode(id: string): SceneNode | null
  destroy(): void
}

/**
 * Satu observeDeep di akar, lalu penyiaran selektif ke pelanggan
 * per-id. Alternatifnya memasang observer di setiap Y.Map node,
 * tapi itu harus dipasang ulang setiap kali node dibuat atau
 * dihapus dan mudah bocor.
 */
function idsYangBerubah(events: Y.YEvent<never>[]): Set<string> {
  const ids = new Set<string>()
  for (const e of events) {
    if (e.path.length === 0) {
      // Perubahan di map akar: node ditambah atau dihapus.
      for (const kunci of (e as unknown as Y.YMapEvent<never>).keysChanged) {
        ids.add(kunci)
      }
    } else {
      // Perubahan di dalam sebuah node: path[0] adalah id-nya.
      ids.add(String(e.path[0]))
    }
  }
  return ids
}

function samaPersis(a: string[] | null, b: string[]): boolean {
  if (a === null || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export function createDocStore(doc: Y.Doc): DocStore {
  const pelangganNode = new Map<string, Set<() => void>>()
  const pelangganIds = new Set<() => void>()

  const cacheNode = new Map<string, SceneNode | null>()
  let cacheIds: string[] = readAllNodes(doc).map((n) => n.id)

  const onDeep = (events: Y.YEvent<never>[]) => {
    const berubah = idsYangBerubah(events)

    // Daftar id hanya disiarkan bila isinya benar-benar berubah.
    // Menyiarkannya pada setiap perubahan properti akan me-render
    // ulang Scene di setiap frame drag, dan itu membatalkan
    // seluruh manfaat langganan per-node.
    const idsBaru = readAllNodes(doc).map((n) => n.id)
    if (!samaPersis(cacheIds, idsBaru)) {
      cacheIds = idsBaru
      for (const cb of pelangganIds) cb()
    }

    for (const id of berubah) {
      cacheNode.delete(id)
      const set = pelangganNode.get(id)
      if (set) for (const cb of set) cb()
    }
  }

  const map = nodesMap(doc)
  // React StrictMode di mode pengembangan menjalankan efek dua kali:
  // pasang → bersihkan → pasang lagi. Pembersihan pertama melepas observer,
  // sementara store-nya sendiri tidak dibuat ulang. Tanpa penanda ini,
  // pelepasan kedua memicu peringatan Yjs dan store berhenti menyimak
  // perubahan — kanvas jadi tampak hidup tapi tak merespons apa pun.
  let terpasang = false
  const pasang = () => {
    if (terpasang) return
    map.observeDeep(onDeep as never)
    terpasang = true
  }
  pasang()

  return {
    pasangUlang: pasang,
    subscribeIds(cb) {
      pelangganIds.add(cb)
      return () => pelangganIds.delete(cb)
    },

    getIds() {
      return cacheIds
    },

    subscribeNode(id, cb) {
      let set = pelangganNode.get(id)
      if (!set) {
        set = new Set()
        pelangganNode.set(id, set)
      }
      set.add(cb)
      return () => {
        set!.delete(cb)
        if (set!.size === 0) pelangganNode.delete(id)
      }
    },

    getNode(id) {
      if (!cacheNode.has(id)) cacheNode.set(id, readNode(doc, id))
      return cacheNode.get(id)!
    },

    destroy() {
      if (!terpasang) return
      map.unobserveDeep(onDeep as never)
      terpasang = false
      pelangganNode.clear()
      pelangganIds.clear()
      cacheNode.clear()
    },
  }
}
