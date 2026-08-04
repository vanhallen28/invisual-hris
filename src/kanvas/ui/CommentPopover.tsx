'use client'

import { useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { hapusKomentar, ubahKomentar, type Komentar } from '@/kanvas/doc/comments'
import { worldToScreen, type Viewport } from '@/kanvas/state/viewport'

/**
 * Popover HTML untuk komentar yang terbuka. Dipasang dengan `key={id}` di induk,
 * jadi tiap komentar dapat instance segar — teks awal dari propnya, dan saat
 * ditutup (unmount) teksnya disimpan; bila kosong, komentarnya dihapus (komentar
 * kosong tidak ditinggalkan).
 */
export function CommentPopover({
  doc,
  viewport,
  komentar,
  onTutup,
}: {
  doc: Y.Doc
  viewport: Viewport
  komentar: Komentar
  onTutup: () => void
}) {
  const [draf, setDraf] = useState(komentar.text)
  const drafRef = useRef(draf)
  drafRef.current = draf
  const areaRef = useRef<HTMLTextAreaElement>(null)

  // Fokus + pilih saat muncul supaya bisa langsung mengetik.
  useEffect(() => {
    areaRef.current?.focus()
    areaRef.current?.select()
  }, [])

  // Saat ditutup/unmount: simpan teks, atau hapus komentar bila kosong.
  useEffect(() => {
    return () => {
      const t = drafRef.current.trim()
      if (t) ubahKomentar(doc, komentar.id, { text: drafRef.current })
      else hapusKomentar(doc, komentar.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = worldToScreen(viewport, komentar.x, komentar.y)

  return (
    <div
      style={{
        position: 'absolute',
        left: s.x + 16,
        top: Math.max(8, s.y - 40),
        width: 244,
        zIndex: 50,
        background: 'var(--surface-2)',
        border: '1px solid var(--line-strong)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,.45)',
        padding: 10,
      }}
      // Klik di dalam popover tidak boleh menutupnya lewat kanvas.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 6 }}>
        {komentar.oleh || 'Anonim'}
      </div>
      <textarea
        ref={areaRef}
        value={draf}
        onChange={(e) => setDraf(e.target.value)}
        rows={3}
        placeholder="Tulis komentar…"
        style={{
          width: '100%',
          background: 'var(--surface-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-0)',
          padding: '5px 7px',
          fontSize: 12,
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => { hapusKomentar(doc, komentar.id); onTutup() }}
          style={{
            padding: '4px 8px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
            background: 'transparent', color: 'var(--text-1)', border: '1px solid var(--line)',
          }}
        >
          Hapus
        </button>
        <button
          type="button"
          onClick={onTutup}
          style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
            background: 'var(--accent)', color: 'var(--void)', border: '1px solid var(--accent)',
          }}
        >
          Selesai
        </button>
      </div>
    </div>
  )
}
