'use client'

import { useEffect, useState } from 'react'
import * as Y from 'yjs'

/**
 * Komentar disimpan di Y.Map TERPISAH dari node scene. Karena provider dan
 * penulis snapshot menyinkron/menyimpan SELURUH dokumen, map ini otomatis ikut
 * tanpa perubahan pada lapisan sinkron — dan komentar tidak mencemari sistem
 * node (layer, hit-test, ekspor). Komentar memang alat tinjauan, bukan isi
 * desain, jadi tidak ikut ke ekspor PNG/SVG.
 */

const KUNCI = 'comments'

export type Komentar = {
  id: string
  x: number
  y: number
  page: string
  text: string
  oleh: string
  pada: number
}

export function commentsMap(doc: Y.Doc): Y.Map<Komentar> {
  return doc.getMap<Komentar>(KUNCI)
}

export function buatKomentar(
  doc: Y.Doc,
  k: { x: number; y: number; page: string; text: string; oleh: string },
): string {
  const id = crypto.randomUUID()
  const rec: Komentar = { id, x: k.x, y: k.y, page: k.page, text: k.text, oleh: k.oleh, pada: Date.now() }
  doc.transact(() => { commentsMap(doc).set(id, rec) }, 'local')
  return id
}

export function ubahKomentar(doc: Y.Doc, id: string, patch: Partial<Komentar>): void {
  const m = commentsMap(doc)
  const cur = m.get(id)
  if (!cur) return
  doc.transact(() => { m.set(id, { ...cur, ...patch }) }, 'local')
}

export function hapusKomentar(doc: Y.Doc, id: string): void {
  doc.transact(() => { commentsMap(doc).delete(id) }, 'local')
}

export function bacaKomentar(doc: Y.Doc): Komentar[] {
  const keluar: Komentar[] = []
  commentsMap(doc).forEach((v) => keluar.push(v))
  return keluar
}

/** Langganan daftar komentar. Pakai state + observe (bukan snapshot langsung)
 *  agar tidak menghasilkan array baru tiap render dan memicu render tak henti. */
export function useKomentar(doc: Y.Doc): Komentar[] {
  const [list, setList] = useState<Komentar[]>(() => bacaKomentar(doc))
  useEffect(() => {
    const m = commentsMap(doc)
    const perbarui = () => setList(bacaKomentar(doc))
    m.observe(perbarui)
    perbarui()
    return () => m.unobserve(perbarui)
  }, [doc])
  return list
}
