'use client'

import { useRef } from 'react'
import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import { updateNode } from '@/kanvas/doc/nodes'
import { worldToScreen, screenToWorld, type Viewport } from '@/kanvas/state/viewport'
import { geserIsi, putarVektor, type Crop } from '@/kanvas/interact/crop'

const BESAR = 100000

/**
 * Overlay "potong isi" untuk node/grup NON-GAMBAR. Menggeser isi di dalam
 * jendela (kotak node); tirai gelap menandai bagian yang terpotong. Skala isi
 * lewat roda mouse (ditangani di EditorClient). Ubah ukuran jendela dilakukan
 * biasa di luar mode ini (dikunci proporsional agar isi tak terdistorsi).
 */
export function ContentCropOverlay({
  store,
  doc,
  id,
  viewport,
  onSelesai,
}: {
  store: DocStore
  doc: Parameters<typeof updateNode>[0]
  id: string
  viewport: Viewport
  onSelesai: () => void
}) {
  const node = useNode(store, id)
  const drag = useRef<{ node0: NonNullable<ReturnType<DocStore['getNode']>>; crop0: Crop; awal: { x: number; y: number } } | null>(null)

  if (!node || !node.crop) return null

  const ptDunia = (e: React.PointerEvent): { x: number; y: number } => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement
    const kotak = svg?.getBoundingClientRect()
    return screenToWorld(viewport, e.clientX - (kotak?.left ?? 0), e.clientY - (kotak?.top ?? 0))
  }

  const mulaiPan = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (!node.crop) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { node0: node, crop0: node.crop, awal: ptDunia(e) }
  }

  const gerak = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = ptDunia(e)
    const lok = putarVektor(p.x - d.awal.x, p.y - d.awal.y, -d.node0.rotation)
    updateNode(doc, id, { crop: geserIsi(d.crop0, lok.x / d.node0.w, lok.y / d.node0.h) })
  }

  const lepas = (e: React.PointerEvent) => {
    if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    }
    drag.current = null
  }

  const zoom = viewport.zoom
  const tl = worldToScreen(viewport, node.x, node.y)
  const w = node.w * zoom
  const h = node.h * zoom
  const cx = tl.x + w / 2
  const cy = tl.y + h / 2
  const rot = node.rotation ? `rotate(${node.rotation} ${cx} ${cy})` : undefined
  const gelap = 'rgba(10,10,10,0.55)'

  return (
    <g transform={rot}>
      {/* Tirai gelap mengelilingi jendela; klik area gelap = selesai. */}
      <g onPointerDown={(e) => { e.stopPropagation(); onSelesai() }}>
        <rect x={-BESAR} y={-BESAR} width={2 * BESAR} height={tl.y + BESAR} fill={gelap} />
        <rect x={-BESAR} y={tl.y + h} width={2 * BESAR} height={BESAR} fill={gelap} />
        <rect x={-BESAR} y={tl.y} width={tl.x + BESAR} height={h} fill={gelap} />
        <rect x={tl.x + w} y={tl.y} width={BESAR} height={h} fill={gelap} />
      </g>

      {/* Area jendela: seret untuk menggeser isi. */}
      <rect
        x={tl.x} y={tl.y} width={w} height={h}
        fill="transparent" pointerEvents="all" style={{ cursor: 'move' }}
        onPointerDown={mulaiPan} onPointerMove={gerak} onPointerUp={lepas}
      />

      {/* Garis bantu pertiga. */}
      <g pointerEvents="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.75}>
        <line x1={tl.x + w / 3} y1={tl.y} x2={tl.x + w / 3} y2={tl.y + h} />
        <line x1={tl.x + (2 * w) / 3} y1={tl.y} x2={tl.x + (2 * w) / 3} y2={tl.y + h} />
        <line x1={tl.x} y1={tl.y + h / 3} x2={tl.x + w} y2={tl.y + h / 3} />
        <line x1={tl.x} y1={tl.y + (2 * h) / 3} x2={tl.x + w} y2={tl.y + (2 * h) / 3} />
      </g>

      {/* Bingkai jendela. */}
      <rect x={tl.x} y={tl.y} width={w} height={h} fill="none" stroke="var(--accent)" strokeWidth={1.5} pointerEvents="none" />
    </g>
  )
}
