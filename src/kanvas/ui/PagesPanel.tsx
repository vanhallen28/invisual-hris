'use client'

import { useState } from 'react'
import type * as Y from 'yjs'
import { Plus, Trash2, FileText, Pencil } from 'lucide-react'
import { addPage, deletePage, renamePage, type Page } from '@/kanvas/doc/pages'

/**
 * Daftar halaman di bagian atas sidebar kiri.
 *
 * Klik ganda pada nama untuk mengganti namanya. Halaman terakhir tidak
 * bisa dihapus — kanvas harus selalu punya minimal satu halaman.
 */
export function PagesPanel({
  doc,
  pages,
  aktif,
  onPilih,
  onBerubah,
}: {
  doc: Y.Doc
  pages: Page[]
  aktif: string
  onPilih: (id: string) => void
  onBerubah: () => void
}) {
  const [sunting, setSunting] = useState<string | null>(null)
  const [teks, setTeks] = useState('')

  const mulaiSunting = (p: Page) => {
    setSunting(p.id)
    setTeks(p.name)
  }

  const simpan = () => {
    if (sunting) renamePage(doc, sunting, teks)
    setSunting(null)
    onBerubah()
  }

  const tambah = () => {
    const id = addPage(doc)
    onBerubah()
    onPilih(id)
  }

  const hapus = (p: Page) => {
    if (pages.length <= 1) return
    if (!confirm(`Hapus halaman "${p.name}" beserta isinya?`)) return
    deletePage(doc, p.id)
    onBerubah()
    if (aktif === p.id) {
      const sisa = pages.filter((x) => x.id !== p.id)
      if (sisa[0]) onPilih(sisa[0].id)
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between" style={{ padding: '10px 12px 6px' }}>
        <h3
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-2)',
          }}
        >
          Halaman
        </h3>
        <button
          onClick={tambah}
          title="Tambah halaman"
          className="flex items-center justify-center"
          style={{ width: 18, height: 18, borderRadius: 'var(--radius)', color: 'var(--text-1)' }}
        >
          <Plus size={13} strokeWidth={1.5} />
        </button>
      </div>

      <div style={{ paddingBottom: 6 }}>
        {pages.map((p) => {
          const on = p.id === aktif
          return (
            <div
              key={p.id}
              className="group flex items-center gap-1.5"
              style={{
                padding: '3px 12px',
                background: on ? 'var(--accent-soft)' : 'transparent',
                color: on ? 'var(--accent)' : 'var(--text-1)',
              }}
            >
              <FileText size={12} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.7 }} />

              {sunting === p.id ? (
                <input
                  autoFocus
                  value={teks}
                  onChange={(e) => setTeks(e.target.value)}
                  onBlur={simpan}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); simpan() }
                    if (e.key === 'Escape') setSunting(null)
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-strong)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-0)',
                    padding: '1px 4px',
                    outline: 'none',
                  }}
                />
              ) : (
                <button
                  onClick={() => onPilih(p.id)}
                  onDoubleClick={() => mulaiSunting(p)}
                  title="Klik ganda untuk mengganti nama"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </button>
              )}

              {sunting !== p.id && (
                <button
                  onClick={() => mulaiSunting(p)}
                  title="Ubah nama"
                  className="opacity-0 group-hover:opacity-100"
                  style={{ color: 'var(--text-2)', flexShrink: 0, transition: 'opacity 120ms' }}
                >
                  <Pencil size={11} strokeWidth={1.5} />
                </button>
              )}

              {pages.length > 1 && sunting !== p.id && (
                <button
                  onClick={() => hapus(p)}
                  title="Hapus halaman"
                  className="opacity-0 group-hover:opacity-100"
                  style={{ color: 'var(--text-2)', flexShrink: 0, transition: 'opacity 120ms' }}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
