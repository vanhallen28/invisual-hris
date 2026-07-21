'use client'

import type { Peer } from '@/kanvas/sync/cursors'
import { worldToScreen, type Viewport } from '@/kanvas/state/viewport'

export function Cursors({ peers, viewport }: { peers: Peer[]; viewport: Viewport }) {
  return (
    <g pointerEvents="none">
      {peers.map((p) => {
        const s = worldToScreen(viewport, p.x, p.y)
        return (
          <g key={p.id} transform={`translate(${s.x} ${s.y})`}>
            <path d="M0 0 L0 14 L4 11 L7 17 L9 16 L6 10 L11 10 Z" fill={p.warna} />
            <rect x={12} y={10} width={p.nama.length * 6.5 + 8} height={15} rx={2} fill={p.warna} />
            <text x={16} y={21} fontSize={10} fill="#000" style={{ fontWeight: 600 }}>
              {p.nama}
            </text>
          </g>
        )
      })}
    </g>
  )
}
