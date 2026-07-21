'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { readNode, updateNode } from '@/kanvas/doc/nodes'
import type { SceneNode } from '@/kanvas/doc/types'
import { screenToWorld, type Viewport } from '@/kanvas/state/viewport'
import { moveBy, resizeFrom, rotateTo, type Box, type Handle } from './transform'

const JEDA_COMMIT_MS = 50

export type Preview = Record<string, Partial<SceneNode>>

type Mode =
  | { jenis: 'geser'; ids: string[]; awalDunia: { x: number; y: number } }
  | { jenis: 'resize'; id: string; handle: Handle }
  | { jenis: 'rotasi'; id: string }

export function useGesture({ doc, viewport }: { doc: Y.Doc; viewport: Viewport }) {
  const [preview, setPreview] = useState<Preview>({})
  const mode = useRef<Mode | null>(null)
  const asli = useRef<Record<string, SceneNode>>({})
  const tertunda = useRef<Preview>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commit = useCallback(() => {
    const batch = tertunda.current
    tertunda.current = {}
    timer.current = null
    // Satu transaksi untuk seluruh node yang bergerak, sehingga
    // satu frame drag menghasilkan satu update Yjs, bukan satu
    // per objek terpilih.
    doc.transact(() => {
      for (const [id, patch] of Object.entries(batch)) updateNode(doc, id, patch)
    }, 'local')
  }, [doc])

  const jadwalkan = useCallback(
    (patch: Preview) => {
      Object.assign(tertunda.current, patch)
      if (timer.current === null) timer.current = setTimeout(commit, JEDA_COMMIT_MS)
    },
    [commit]
  )

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [])

  const mulai = useCallback(
    (m: Mode) => {
      mode.current = m
      asli.current = {}
      const ids = m.jenis === 'geser' ? m.ids : [m.id]
      for (const id of ids) {
        const n = readNode(doc, id)
        if (n) asli.current[id] = n
      }
    },
    [doc]
  )

  const lanjut = useCallback(
    (screenX: number, screenY: number, shift: boolean) => {
      const m = mode.current
      if (!m) return

      const dunia = screenToWorld(viewport, screenX, screenY)
      const patch: Preview = {}

      if (m.jenis === 'geser') {
        const dx = dunia.x - m.awalDunia.x
        const dy = dunia.y - m.awalDunia.y
        for (const id of m.ids) {
          const n = asli.current[id]
          if (n) patch[id] = moveBy(n, dx, dy)
        }
      } else if (m.jenis === 'resize') {
        const n = asli.current[m.id]
        if (n) patch[m.id] = resizeFrom(n, m.handle, dunia.x, dunia.y, shift) as Box
      } else {
        const n = asli.current[m.id]
        if (n) patch[m.id] = { rotation: rotateTo(n, dunia.x, dunia.y, shift) }
      }

      // Pratinjau diperbarui setiap frame; dokumen hanya ter-throttle.
      setPreview((lama) => ({ ...lama, ...patch }))
      jadwalkan(patch)
    },
    [viewport, jadwalkan]
  )

  const selesai = useCallback(() => {
    if (!mode.current) return
    mode.current = null
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    // Commit terakhir wajib: tanpa ini, gerakan di 50 ms
    // terakhir sebelum jari diangkat akan hilang.
    commit()
    setPreview({})
    asli.current = {}
  }, [commit])

  // `aktif` sengaja TIDAK dikembalikan. Nilainya berasal dari ref,
  // dan ref yang dibaca saat render tidak pernah memicu render
  // ulang — pemanggil akan selalu melihat nilai basi dari render
  // sebelumnya, sehingga pointermove tidak pernah meneruskan
  // gestur dan drag tidak jalan sama sekali. `lanjut` sudah
  // memeriksa mode-nya sendiri, jadi aman dipanggil tanpa syarat.
  return { preview, mulai, lanjut, selesai }
}
