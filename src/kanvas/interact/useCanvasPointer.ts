'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { readAllNodes } from '@/kanvas/doc/nodes'
import { panBy, screenToWorld, zoomAt, type Viewport } from '@/kanvas/state/viewport'
import { topmostAt } from './hitTest'

type Args = {
  doc: Y.Doc
  viewport: Viewport
  setViewport: (fn: (vp: Viewport) => Viewport) => void
  selection: string[]
  setSelection: (ids: string[]) => void
}

export function useCanvasPointer({
  doc,
  viewport,
  setViewport,
  selection,
  setSelection,
}: Args) {
  const [spasiDitekan, setSpasiDitekan] = useState(false)
  const [menggeser, setMenggeser] = useState(false)
  const geser = useRef<{ x: number; y: number } | null>(null)

  // Spasi menahan mode pan sementara, konvensi yang sama dengan
  // hampir semua editor grafis.
  useEffect(() => {
    const turun = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setSpasiDitekan(true)
      }
    }
    const naik = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpasiDitekan(false)
    }
    window.addEventListener('keydown', turun)
    window.addEventListener('keyup', naik)
    return () => {
      window.removeEventListener('keydown', turun)
      window.removeEventListener('keyup', naik)
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const kotak = e.currentTarget.getBoundingClientRect()
      const sx = e.clientX - kotak.left
      const sy = e.clientY - kotak.top

      // Tombol tengah atau spasi memulai pan.
      if (e.button === 1 || spasiDitekan) {
        geser.current = { x: e.clientX, y: e.clientY }
        setMenggeser(true)
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }

      if (e.button !== 0) return

      const dunia = screenToWorld(viewport, sx, sy)
      const kena = topmostAt(readAllNodes(doc), dunia.x, dunia.y)

      if (!kena) {
        setSelection([])
        return
      }

      if (e.shiftKey) {
        // Shift membalik keanggotaan: menambah bila belum ada,
        // mengeluarkan bila sudah.
        setSelection(
          selection.includes(kena.id)
            ? selection.filter((id) => id !== kena.id)
            : [...selection, kena.id]
        )
      } else {
        setSelection([kena.id])
      }
    },
    [doc, viewport, spasiDitekan, selection, setSelection]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!geser.current) return
      const dx = e.clientX - geser.current.x
      const dy = e.clientY - geser.current.y
      geser.current = { x: e.clientX, y: e.clientY }
      setViewport((vp) => panBy(vp, dx, dy))
    },
    [setViewport]
  )

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    geser.current = null
    setMenggeser(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      const kotak = e.currentTarget.getBoundingClientRect()
      const sx = e.clientX - kotak.left
      const sy = e.clientY - kotak.top

      // Ctrl/Cmd + wheel adalah pinch-zoom di trackpad;
      // wheel biasa menggulir kanvas.
      if (e.ctrlKey || e.metaKey) {
        setViewport((vp) => zoomAt(vp, sx, sy, Math.exp(-e.deltaY * 0.01)))
      } else {
        setViewport((vp) => panBy(vp, -e.deltaX, -e.deltaY))
      }
    },
    [setViewport]
  )

  return {
    // Dibaca dari state, bukan dari ref. Ref yang dibaca saat
    // render tidak pernah memicu render ulang, jadi kursor tidak
    // akan pernah berubah saat pan dimulai lewat tombol tengah.
    isPanning: spasiDitekan || menggeser,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onWheel },
  }
}
