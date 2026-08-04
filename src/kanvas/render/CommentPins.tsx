'use client'

import type { Komentar } from '@/kanvas/doc/comments'
import { worldToScreen, type Viewport } from '@/kanvas/state/viewport'

/**
 * Pin komentar digambar di ruang LAYAR (ukuran tetap berapa pun zoom), dengan
 * ujung pin menunjuk tepat ke posisi dunianya. Klik pin = buka popover.
 */
export function CommentPins({
  komentar,
  viewport,
  page,
  openId,
  onBuka,
}: {
  komentar: Komentar[]
  viewport: Viewport
  page: string
  openId: string | null
  onBuka: (id: string) => void
}) {
  return (
    <g>
      {komentar
        .filter((k) => k.page === page)
        .map((k) => {
          const s = worldToScreen(viewport, k.x, k.y)
          const aktif = k.id === openId
          const warna = aktif ? 'var(--accent)' : 'var(--magenta, #de236e)'
          const inisial = (k.oleh || '?').trim().charAt(0).toUpperCase() || '?'
          return (
            <g
              key={k.id}
              transform={`translate(${s.x} ${s.y})`}
              style={{ cursor: 'pointer' }}
              pointerEvents="all"
              onPointerDown={(e) => { e.stopPropagation(); onBuka(k.id) }}
            >
              {/* Ekor menunjuk ke titik (0,0). */}
              <path d="M0 0 L-7 -13 L7 -13 Z" fill={warna} />
              {/* Kepala pin. */}
              <circle cx={0} cy={-20} r={11} fill={warna} stroke="#fff" strokeWidth={1.5} />
              <text
                x={0} y={-20} textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize={11} fontWeight={600}
                style={{ userSelect: 'none' }}
              >
                {inisial}
              </text>
            </g>
          )
        })}
    </g>
  )
}
