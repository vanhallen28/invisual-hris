'use client'

import { useRef } from 'react'
import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import { updateNode } from '@/kanvas/doc/nodes'
import type { PenPoint } from '@/kanvas/doc/types'
import { worldToScreen, screenToWorld, type Viewport } from '@/kanvas/state/viewport'
import { bboxPen, geserAnchor, setHandle, putarTitik, sisipTitik, toggleTitik, titikTengahRuas } from '@/kanvas/interact/pen'

type Seret =
  | { mode: 'anchor'; i: number; pts0: PenPoint[]; awalX: number; awalY: number }
  | { mode: 'handle'; i: number; sisi: 'in' | 'out'; pts0: PenPoint[] }

/**
 * Lapisan mode sunting jalur Pen. Digambar di ruang LAYAR (gagang berukuran
 * tetap), dibungkus rotasi node bila ada. Semua interaksi mandiri lewat
 * penangkapan pointer sendiri — tak menyentuh sistem gestur biasa.
 */
export function PathEditOverlay({
  store,
  doc,
  id,
  viewport,
  sel,
  onPilih,
  onSelesai,
}: {
  store: DocStore
  doc: Parameters<typeof updateNode>[0]
  id: string
  viewport: Viewport
  sel: number | null
  onPilih: (i: number) => void
  onSelesai: () => void
}) {
  const node = useNode(store, id)
  const seret = useRef<Seret | null>(null)

  if (!node || (node.type !== 'pen' && node.type !== 'textpath') || !node.path) return null
  const pts = node.path.pts
  const closed = node.path.closed
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2

  // Titik pointer → ruang LOKAL (pra-rotasi) node.
  const ptLokal = (e: React.PointerEvent): { x: number; y: number } => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement
    const kotak = svg?.getBoundingClientRect()
    const w = screenToWorld(viewport, e.clientX - (kotak?.left ?? 0), e.clientY - (kotak?.top ?? 0))
    return putarTitik(w.x, w.y, cx, cy, -node.rotation)
  }

  const tulis = (npts: PenPoint[]) => {
    const bb = bboxPen(npts)
    updateNode(doc, id, { x: bb.x, y: bb.y, w: bb.w, h: bb.h, path: { pts: npts, closed } })
  }

  const mulaiAnchor = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    onPilih(i)
    const p = ptLokal(e)
    seret.current = { mode: 'anchor', i, pts0: pts, awalX: p.x, awalY: p.y }
  }

  const mulaiHandle = (i: number, sisi: 'in' | 'out') => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    onPilih(i)
    seret.current = { mode: 'handle', i, sisi, pts0: pts }
  }

  const gerak = (e: React.PointerEvent) => {
    const d = seret.current
    if (!d) return
    const p = ptLokal(e)
    if (d.mode === 'anchor') {
      tulis(geserAnchor(d.pts0, d.i, p.x - d.awalX, p.y - d.awalY))
    } else {
      tulis(setHandle(d.pts0, d.i, d.sisi, p.x, p.y))
    }
  }

  const lepas = (e: React.PointerEvent) => {
    if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    }
    seret.current = null
  }

  const cxS = worldToScreen(viewport, cx, cy)
  const rot = node.rotation ? `rotate(${node.rotation} ${cxS.x} ${cxS.y})` : undefined
  const S = (x: number, y: number) => worldToScreen(viewport, x, y)

  return (
    <g>
      {/* Latar penangkap klik: klik di luar anchor/handle = selesai menyunting. */}
      <rect
        x={0} y={0} width="100%" height="100%"
        fill="transparent" pointerEvents="all"
        onPointerDown={(e) => { e.stopPropagation(); onSelesai() }}
      />

      <g transform={rot}>
        {/* Garis & titik handle. */}
        {pts.map((p, i) => {
          const a = S(p.x, p.y)
          const punyaIn = p.hix != null && p.hiy != null
          const punyaOut = p.hox != null && p.hoy != null
          return (
            <g key={`h-${i}`}>
              {punyaIn && (() => {
                const h = S(p.hix as number, p.hiy as number)
                return (
                  <>
                    <line x1={a.x} y1={a.y} x2={h.x} y2={h.y} stroke="var(--accent)" strokeWidth={1} opacity={0.7} pointerEvents="none" />
                    <circle
                      cx={h.x} cy={h.y} r={3.5} fill="var(--surface-0)" stroke="var(--accent)" strokeWidth={1.5}
                      style={{ cursor: 'move' }} pointerEvents="all"
                      onPointerDown={mulaiHandle(i, 'in')} onPointerMove={gerak} onPointerUp={lepas}
                    />
                  </>
                )
              })()}
              {punyaOut && (() => {
                const h = S(p.hox as number, p.hoy as number)
                return (
                  <>
                    <line x1={a.x} y1={a.y} x2={h.x} y2={h.y} stroke="var(--accent)" strokeWidth={1} opacity={0.7} pointerEvents="none" />
                    <circle
                      cx={h.x} cy={h.y} r={3.5} fill="var(--surface-0)" stroke="var(--accent)" strokeWidth={1.5}
                      style={{ cursor: 'move' }} pointerEvents="all"
                      onPointerDown={mulaiHandle(i, 'out')} onPointerMove={gerak} onPointerUp={lepas}
                    />
                  </>
                )
              })()}
            </g>
          )
        })}

        {/* Penanda "+" di tengah tiap ruas: klik = sisipkan titik di situ. */}
        {pts.map((_, i) => {
          const akhir = i === pts.length - 1
          if (akhir && !closed) return null
          const tm = titikTengahRuas(pts, i, closed)
          if (!tm) return null
          const c = S(tm.x, tm.y)
          return (
            <g
              key={`m-${i}`}
              style={{ cursor: 'copy' }} pointerEvents="all"
              onPointerDown={(e) => {
                e.stopPropagation()
                tulis(sisipTitik(pts, i, closed))
                onPilih(i + 1)
              }}
            >
              <circle cx={c.x} cy={c.y} r={5} fill="var(--surface-0)" stroke="var(--accent)" strokeWidth={1} opacity={0.85} />
              <line x1={c.x - 2.5} y1={c.y} x2={c.x + 2.5} y2={c.y} stroke="var(--accent)" strokeWidth={1} />
              <line x1={c.x} y1={c.y - 2.5} x2={c.x} y2={c.y + 2.5} stroke="var(--accent)" strokeWidth={1} />
            </g>
          )
        })}

        {/* Titik anchor (yang terpilih disorot). Dobel-klik = sudut↔mulus. */}
        {pts.map((p, i) => {
          const a = S(p.x, p.y)
          const dipilih = sel === i
          return (
            <rect
              key={`a-${i}`}
              x={a.x - 5} y={a.y - 5} width={10} height={10}
              fill={dipilih ? 'var(--accent)' : 'var(--surface-0)'}
              stroke="var(--accent)" strokeWidth={1.5}
              style={{ cursor: 'move' }} pointerEvents="all"
              onPointerDown={mulaiAnchor(i)} onPointerMove={gerak} onPointerUp={lepas}
              onDoubleClick={(e) => { e.stopPropagation(); tulis(toggleTitik(pts, i, closed)); onPilih(i) }}
            />
          )
        })}
      </g>
    </g>
  )
}
