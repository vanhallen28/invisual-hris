import * as Y from 'yjs'
import { nodesMap } from './doc'
import type { YNode } from './types'

/**
 * Halaman kanvas.
 *
 * Disimpan sebagai Y.Map tersendiri di dalam dokumen, dan tiap node
 * menyimpan `page` berisi id halamannya. Cara ini dipilih karena node
 * sudah punya `parent` untuk hierarki frame dan grup — memakai `parent`
 * juga untuk halaman akan mencampur dua urusan yang berbeda.
 *
 * Node lama yang belum punya `page` dianggap milik halaman pertama,
 * sehingga kanvas yang sudah terlanjur dibuat tetap terbaca.
 */

export const PAGES_KEY = 'pages'

export interface Page {
  id: string
  name: string
  order: number
}

export function pagesMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(PAGES_KEY)
}

export function listPages(doc: Y.Doc): Page[] {
  const map = pagesMap(doc)
  const keluar: Page[] = []
  map.forEach((nilai, id) => {
    const p = nilai as { name?: string; order?: number }
    keluar.push({ id, name: String(p?.name ?? 'Halaman'), order: Number(p?.order ?? 0) })
  })
  return keluar.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

export function addPage(doc: Y.Doc, name?: string): string {
  const map = pagesMap(doc)
  const id = crypto.randomUUID()
  const urutan = listPages(doc).reduce((m, p) => Math.max(m, p.order), 0) + 1
  doc.transact(() => {
    map.set(id, { name: name?.trim() || `Halaman ${urutan}`, order: urutan })
  })
  return id
}

export function renamePage(doc: Y.Doc, id: string, name: string): void {
  const map = pagesMap(doc)
  const lama = map.get(id) as { name?: string; order?: number } | undefined
  if (!lama) return
  doc.transact(() => {
    map.set(id, { name: name.trim() || 'Halaman', order: Number(lama.order ?? 0) })
  })
}

/** Menghapus halaman beserta seluruh node di dalamnya. */
export function deletePage(doc: Y.Doc, id: string): void {
  const map = pagesMap(doc)
  const nodes = nodesMap(doc)
  doc.transact(() => {
    const buang: string[] = []
    nodes.forEach((n, nodeId) => {
      if (((n as YNode).get('page') as string | undefined) === id) buang.push(nodeId)
    })
    for (const nodeId of buang) nodes.delete(nodeId)
    map.delete(id)
  })
}

/**
 * Memastikan dokumen selalu punya minimal satu halaman, lalu
 * mengembalikan id halaman pertama.
 */
export function ensureFirstPage(doc: Y.Doc): string {
  const ada = listPages(doc)
  if (ada.length > 0) return ada[0].id
  return addPage(doc, 'Halaman 1')
}

/**
 * Halaman sebuah node. Node tanpa `page` — buatan versi sebelum fitur
 * ini ada — dianggap milik halaman pertama.
 */
export function pageDariNode(n: { page?: string } | undefined, halamanPertama: string): string {
  return n?.page || halamanPertama
}
