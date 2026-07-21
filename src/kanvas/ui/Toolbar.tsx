'use client'

import { useEffect, useRef, useState } from 'react'
import {
  MousePointer2, Hand, Frame, Square, Circle, Minus, MoveUpRight, Triangle, Star, Type, Image as ImageIcon, ChevronRight,
} from 'lucide-react'
import { TOOL_LABEL, type Tool } from '@/kanvas/state/tool'

/**
 * Alat gambar, disusun bergrup seperti editor grafis pada umumnya.
 *
 * Grup yang isinya lebih dari satu punya menu: ikon yang tampil adalah
 * alat yang terakhir dipakai di grup itu, dan panah kecil membuka
 * sisanya. Dengan begitu kolomnya tetap ramping tapi semua alat
 * terjangkau — dan tak ada tombol yang sekadar pajangan.
 */

type Ikon = React.ComponentType<{ size?: number; strokeWidth?: number }>

const IKON: Record<Tool, Ikon> = {
  select: MousePointer2,
  hand: Hand,
  frame: Frame,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: MoveUpRight,
  polygon: Triangle,
  star: Star,
  text: Type,
}

// Aksi yang bukan tool: tidak mengubah mode kanvas, hanya sekali jalan.
export type Aksi = 'gambar'

type Isi = { tool: Tool } | { aksi: Aksi; label: string; ikon: Ikon }

const GRUP: Isi[][] = [
  [{ tool: 'select' }, { tool: 'hand' }],
  [{ tool: 'frame' }],
  [
    { tool: 'rect' },
    { tool: 'ellipse' },
    { tool: 'line' },
    { tool: 'arrow' },
    { tool: 'polygon' },
    { tool: 'star' },
    { aksi: 'gambar', label: 'Gambar…  ⇧⌘K', ikon: ImageIcon },
  ],
  [{ tool: 'text' }],
]

export function Toolbar({
  tool,
  onTool,
  onAksi,
}: {
  tool: Tool
  onTool: (t: Tool) => void
  onAksi?: (a: Aksi) => void
}) {
  const [menu, setMenu] = useState<number | null>(null)
  // Ikon yang ditampilkan tiap grup — mengingat pilihan terakhir.
  const [wakil, setWakil] = useState<Record<number, Tool>>({})
  const bungkusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (menu === null) return
    const luar = (e: MouseEvent) => {
      if (!bungkusRef.current?.contains(e.target as Node)) setMenu(null)
    }
    window.addEventListener('mousedown', luar)
    return () => window.removeEventListener('mousedown', luar)
  }, [menu])

  const toolGrup = (isi: Isi[]) => isi.filter((x): x is { tool: Tool } => 'tool' in x).map((x) => x.tool)

  return (
    <div ref={bungkusRef} className="flex flex-col items-center gap-1">
      {GRUP.map((isi, gi) => {
        const daftarTool = toolGrup(isi)
        const aktifDiSini = daftarTool.includes(tool)
        const tampil = aktifDiSini ? tool : (wakil[gi] ?? daftarTool[0])
        const Ikon = IKON[tampil]
        const banyak = isi.length > 1

        return (
          <div key={gi} className="relative flex flex-col items-center">
            <button
              onClick={() => onTool(tampil)}
              title={TOOL_LABEL[tampil]}
              className="flex items-center justify-center"
              style={{
                width: 28, height: 28, borderRadius: 'var(--radius)',
                // Tool aktif ditandai isian aksen redup, bukan warna penuh:
                // chrome harus tetap tenang di sebelah kanvas.
                background: aktifDiSini ? 'var(--accent-soft)' : 'transparent',
                color: aktifDiSini ? 'var(--accent)' : 'var(--text-1)',
              }}
            >
              <Ikon size={15} strokeWidth={1.5} />
            </button>

            {banyak && (
              <button
                onClick={() => setMenu(menu === gi ? null : gi)}
                title="Alat lain"
                className="flex items-center justify-center"
                style={{ width: 28, height: 10, color: 'var(--text-2)' }}
              >
                <ChevronRight size={9} strokeWidth={2} style={{ transform: 'rotate(90deg)' }} />
              </button>
            )}

            {banyak && menu === gi && (
              <div
                className="absolute"
                style={{
                  right: 34, top: 0, minWidth: 168, padding: 4, zIndex: 40,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,.45)',
                }}
              >
                {isi.map((x, xi) => {
                  if ('aksi' in x) {
                    const IkonAksi = x.ikon
                    return (
                      <button
                        key={`a-${xi}`}
                        onClick={() => { setMenu(null); onAksi?.(x.aksi) }}
                        className="flex w-full items-center gap-2.5"
                        style={{ padding: '5px 8px', borderRadius: 'var(--radius)', color: 'var(--text-1)', fontSize: 12 }}
                      >
                        <IkonAksi size={14} strokeWidth={1.5} />
                        <span style={{ flex: 1, textAlign: 'left' }}>{x.label}</span>
                      </button>
                    )
                  }
                  const IkonTool = IKON[x.tool]
                  const on = x.tool === tool
                  const [nama, kunci] = TOOL_LABEL[x.tool].split('  ')
                  return (
                    <button
                      key={x.tool}
                      onClick={() => {
                        setWakil((w) => ({ ...w, [gi]: x.tool }))
                        onTool(x.tool)
                        setMenu(null)
                      }}
                      className="flex w-full items-center gap-2.5"
                      style={{
                        padding: '5px 8px', borderRadius: 'var(--radius)', fontSize: 12,
                        background: on ? 'var(--accent-soft)' : 'transparent',
                        color: on ? 'var(--accent)' : 'var(--text-1)',
                      }}
                    >
                      <IkonTool size={14} strokeWidth={1.5} />
                      <span style={{ flex: 1, textAlign: 'left' }}>{nama}</span>
                      <span className="num" style={{ color: 'var(--text-2)' }}>{kunci}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
