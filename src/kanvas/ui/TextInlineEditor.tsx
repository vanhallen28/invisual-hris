'use client'

import { useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import { updateNode } from '@/kanvas/doc/nodes'
import { worldToScreen, type Viewport } from '@/kanvas/state/viewport'

/**
 * Editor teks langsung di kanvas. Sebuah <textarea> HTML ditumpuk tepat di atas
 * node teks (posisi, ukuran, font, warna, perataan, & rotasi menyesuaikan),
 * sehingga teks bisa diketik langsung — bukan lewat panel. Teks disimpan saat
 * editor ditutup (blur / Escape). Node aslinya disembunyikan selama mengedit
 * agar tidak tampil ganda; ukurannya menyesuaikan sendiri (mode resize teks)
 * setelah commit.
 */
export function TextInlineEditor({
  doc,
  store,
  id,
  viewport,
  pilihSemua,
  onSelesai,
}: {
  doc: Y.Doc
  store: DocStore
  id: string
  viewport: Viewport
  /** true saat teks baru dibuat: pilih semua supaya ketikan mengganti 'Teks'. */
  pilihSemua: boolean
  onSelesai: () => void
}) {
  const node = useNode(store, id)
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draf, setDraf] = useState(node?.text ?? '')
  const drafRef = useRef(draf)
  drafRef.current = draf

  // Fokus saat muncul; pilih semua (teks baru) atau taruh kursor di akhir.
  useEffect(() => {
    const t = ref.current
    if (!t) return
    t.focus()
    if (pilihSemua) t.select()
    else t.setSelectionRange(t.value.length, t.value.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Simpan teks saat editor dilepas (blur/Escape/klik luar).
  useEffect(() => {
    return () => { updateNode(doc, id, { text: drafRef.current }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, id])

  if (!node) return null

  const zoom = viewport.zoom
  const tl = worldToScreen(viewport, node.x, node.y)
  const fs = (node.fontSize && node.fontSize > 0 ? node.fontSize : 16) * zoom
  const w = Math.max(24, node.w * zoom)
  const h = Math.max(fs, node.h * zoom)
  const rot = node.rotation ? `rotate(${node.rotation}deg)` : undefined

  return (
    <textarea
      ref={ref}
      value={draf}
      onChange={(e) => { setDraf(e.target.value); updateNode(doc, id, { text: e.target.value }) }}
      onBlur={onSelesai}
      onKeyDown={(e) => {
        e.stopPropagation() // jangan picu pintasan kanvas (hapus, ganti alat)
        if (e.key === 'Escape') { e.preventDefault(); onSelesai() }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      spellCheck={false}
      style={{
        position: 'absolute',
        left: tl.x,
        top: tl.y,
        width: w,
        height: h,
        transform: rot,
        transformOrigin: 'center',
        font: `${node.fontWeight || 400} ${fs}px ${node.fontFamily || 'var(--font-ui), sans-serif'}`,
        lineHeight: String(node.lineHeight || 1.2),
        letterSpacing: `${(node.letterSpacing || 0) * zoom}px`,
        color: node.fill || '#fff',
        textAlign: (node.align || 'left') as 'left' | 'center' | 'right',
        background: 'transparent',
        border: '1px solid var(--accent)',
        outline: 'none',
        resize: 'none',
        padding: 0,
        margin: 0,
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
        zIndex: 60,
      }}
    />
  )
}
