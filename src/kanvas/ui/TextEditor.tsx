'use client'

import { useState } from 'react'
import type * as Y from 'yjs'
import { updateNode } from '@/kanvas/doc/nodes'
import type { SceneNode } from '@/kanvas/doc/types'

export function TextEditor({ doc, node }: { doc: Y.Doc; node: SceneNode }) {
  const [draf, setDraf] = useState(node.text ?? '')

  // Disinkronkan saat render, bukan di effect (pola resmi React
  // "menyesuaikan state ketika prop berubah").
  const [teksLama, setTeksLama] = useState(node.text ?? '')
  if ((node.text ?? '') !== teksLama) {
    setTeksLama(node.text ?? '')
    setDraf(node.text ?? '')
  }

  return (
    <textarea
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
