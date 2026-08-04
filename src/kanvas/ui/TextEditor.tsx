'use client'

import { useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { updateNode } from '@/kanvas/doc/nodes'
import type { SceneNode } from '@/kanvas/doc/types'

export function TextEditor({
  doc,
  node,
  autoFokus,
  onFokusSelesai,
}: {
  doc: Y.Doc
  node: SceneNode
  /** Fokus + pilih seluruh teks saat pertama tampil (mis. objek teks baru dibuat). */
  autoFokus?: boolean
  onFokusSelesai?: () => void
}) {
  const [draf, setDraf] = useState(node.text ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)

  // Disinkronkan saat render, bukan di effect (pola resmi React
  // "menyesuaikan state ketika prop berubah").
  const [teksLama, setTeksLama] = useState(node.text ?? '')
  if ((node.text ?? '') !== teksLama) {
    setTeksLama(node.text ?? '')
    setDraf(node.text ?? '')
  }

  // Fokus sekali saat mount bila diminta — supaya objek "Teks di jalur" yang
  // baru digambar bisa langsung diketik (teks contoh tersorot untuk ditimpa).
  useEffect(() => {
    if (autoFokus && ref.current) {
      ref.current.focus()
      ref.current.select()
      onFokusSelesai?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <textarea
      ref={ref}
      value={draf}
      onChange={(e) => setDraf(e.target.value)}
      onBlur={() => updateNode(doc, node.id, { text: draf })}
      rows={3}
      className="col-span-2 w-full"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        color: 'var(--text-0)',
        padding: '4px 6px',
        resize: 'vertical',
      }}
    />
  )
}
