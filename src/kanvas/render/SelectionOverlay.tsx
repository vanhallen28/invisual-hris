'use client'

import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import type { SceneNode } from '@/kanvas/doc/types'
import type { Handle } from '@/kanvas/interact/transform'
import { worldToScreen, type Viewport } from '@/kanvas/state/viewport'

const UKURAN_HANDLE = 7
const JARAK_ROTASI = 22

const KURSOR: Record<Handle, string> = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
  se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
}

type Props = {
  store: DocStore
  selection: string[]
  viewport: Viewport
  preview?: Record<string, Partial<SceneNode>>
  onHandleDown: (e: React.PointerEvent, id: string, handle: Handle) => void
  onRotateDown: (e: React.PointerEvent, id: string) => void
}

function KotakSeleksi({
  store, id, viewport, preview, onHandleDown, onRotateDown, sendiri,
}: Omit<Props, 'selection'> & { id: string; sendiri: boolean }) {
  const dasar = useNode(store, id)
  if (!dasar) return null
  const n = preview?.[id] ? { ...dasar, ...preview[id] } : dasar

  const kiriAtas = worldToScreen(viewport, n.x, n.y)
  const w = n.w * viewport.zoom
  const h = n.h * viewport.zoom
  const cx = kiriAtas.x + w / 2
  const cy = kiriAtas.y + h / 2

  const titik: Array<[Handle, number, number]> = [
    ['nw', kiriAtas.x, kiriAtas.y],
    ['n', cx, kiriAtas.y],
    ['ne', kiriAtas.x + w, kiriAtas.y],
    ['e', kiriAtas.x + w, cy],
    ['se', kiriAtas.x + w, kiriAtas.y + h],
    ['s', cx, kiriAtas.y + h],
    ['sw', kiriAtas.x, kiriAtas.y + h],
    ['w', kiriAtas.x, cy],
  ]

  return (
    <g transform={n.rotation ? `rotate(${n.rotation} ${cx} ${cy})` : undefined}>
      <rect
        x={kiriAtas.x} y={kiriAtas.y} width={w} height={h}
        fill="none" stroke="var(--accent)" strokeWidth={1}
      />

      {/* Handle hanya muncul saat satu objek terpilih. Menampilkan
          delapan handle per objek pada seleksi jamak membuat kanvas
          penuh kotak dan tak terbaca. */}
      {sendiri && (
        <>
          <line
            x1={cx} y1={kiriAtas.y} x2={cx} y2={kiriAtas.y - JARAK_ROTASI}
            stroke="var(--accent)" strokeWidth={1}
          />
          <circle
            cx={cx} cy={kiriAtas.y - JARAK_ROTASI} r={UKURAN_HANDLE / 2 + 1}
            fill="var(--surface-0)" stroke="var(--accent)" strokeWidth={1}
            style={{ cursor: 'grab' }} pointerEvents="all"
            onPointerDown={(e) => onRotateDown(e, id)}
          />
          {titik.map(([handle, hx, hy]) => (
            <rect
              key={handle}
              x={hx - UKURAN_HANDLE / 2} y={hy - UKURAN_HANDLE / 2}
              width={UKURAN_HANDLE} height={UKURAN_HANDLE}
              fill="var(--surface-0)" stroke="var(--accent)" strokeWidth={1}
              style={{ cursor: KURSOR[handle] }} pointerEvents="all"
              onPointerDown={(e) => onHandleDown(e, id, handle)}
            />
          ))}
        </>
      )}
    </g>
  )
}

export function SelectionOverlay({ selection, ...rest }: Props) {
  if (selection.length === 0) return null
  return (
    <g pointerEvents="none">
      {selection.map((id) => (
        <KotakSeleksi key={id} id={id} sendiri={selection.length === 1} {...rest} />
      ))}
    </g>
  )
}
