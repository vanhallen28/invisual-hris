'use client'

import { useState } from 'react'
import type * as Y from 'yjs'
import { Eye, EyeOff, Lock, Unlock, Link2, Unlink2 } from 'lucide-react'
import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import { readNode, updateNode } from '@/kanvas/doc/nodes'
import type { SceneNode } from '@/kanvas/doc/types'
import { DEFAULT_NAME } from '@/kanvas/doc/types'
import { ColorField, NumField } from './Field'
import { jumlahSisi, SISI_MAKS, SISI_MIN } from '@/kanvas/doc/polygon'
import { TextEditor } from './TextEditor'

function Bagian({
  judul,
  children,
  kolom = 2,
  aksi,
}: {
  judul: string
  children: React.ReactNode
  kolom?: number
  aksi?: React.ReactNode
}) {
  return (
    <section style={{ borderBottom: '1px solid var(--line)', padding: '10px 12px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <h3
          style={{
            color: 'var(--text-2)', fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {judul}
        </h3>
        {aksi}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${kolom}, minmax(0, 1fr))` }}>
        {children}
      </div>
    </section>
  )
}

/* ── Tombol kecil beribu ikon ──────────────────────────────── */
function TombolIkon({
  title, onClick, aktif, children,
}: {
  title: string
  onClick: () => void
  aktif?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        width: 24, height: 22, borderRadius: 'var(--radius)',
        background: aktif ? 'var(--accent-soft)' : 'transparent',
        color: aktif ? 'var(--accent)' : 'var(--text-1)',
      }}
    >
      {children}
    </button>
  )
}

/* Ikon perataan digambar sendiri, bukan diambil dari pustaka ikon:
   namanya berbeda-beda antar versi, dan kegagalan impor akan
   menjatuhkan seluruh editor. Bentuknya juga jadi persis seragam. */
function IkonRata({ arah }: { arah: 'kiri' | 'tengahH' | 'kanan' | 'atas' | 'tengahV' | 'bawah' }) {
  const g = { stroke: 'currentColor', strokeWidth: 1.2, fill: 'none' } as const
  const isi = { fill: 'currentColor', opacity: 0.55 } as const
  switch (arah) {
    case 'kiri':
      return <svg width="13" height="13" viewBox="0 0 14 14"><line x1="2" y1="2" x2="2" y2="12" {...g} /><rect x="4" y="3" width="7" height="3" {...isi} /><rect x="4" y="8" width="4" height="3" {...isi} /></svg>
    case 'tengahH':
      return <svg width="13" height="13" viewBox="0 0 14 14"><line x1="7" y1="2" x2="7" y2="12" {...g} /><rect x="3" y="3" width="8" height="3" {...isi} /><rect x="5" y="8" width="4" height="3" {...isi} /></svg>
    case 'kanan':
      return <svg width="13" height="13" viewBox="0 0 14 14"><line x1="12" y1="2" x2="12" y2="12" {...g} /><rect x="3" y="3" width="7" height="3" {...isi} /><rect x="6" y="8" width="4" height="3" {...isi} /></svg>
    case 'atas':
      return <svg width="13" height="13" viewBox="0 0 14 14"><line x1="2" y1="2" x2="12" y2="2" {...g} /><rect x="3" y="4" width="3" height="7" {...isi} /><rect x="8" y="4" width="3" height="4" {...isi} /></svg>
    case 'tengahV':
      return <svg width="13" height="13" viewBox="0 0 14 14"><line x1="2" y1="7" x2="12" y2="7" {...g} /><rect x="3" y="3" width="3" height="8" {...isi} /><rect x="8" y="5" width="3" height="4" {...isi} /></svg>
    default:
      return <svg width="13" height="13" viewBox="0 0 14 14"><line x1="2" y1="12" x2="12" y2="12" {...g} /><rect x="3" y="3" width="3" height="7" {...isi} /><rect x="8" y="6" width="3" height="4" {...isi} /></svg>
  }
}

type Arah = 'kiri' | 'tengahH' | 'kanan' | 'atas' | 'tengahV' | 'bawah'

export function PropertiesPanel({
  doc, store, selection,
}: {
  doc: Y.Doc
  store: DocStore
  selection: string[]
}) {
  const satu = selection.length === 1 ? selection[0] : null
  const node = useNode(store, satu ?? '')
  const [kunciRasio, setKunciRasio] = useState(false)

  const kerangka = {
    width: 216, borderLeft: '1px solid var(--line)', background: 'var(--surface-1)',
  } as const

  /* Perataan bekerja pada dua objek atau lebih: yang dijadikan acuan
     adalah kotak gabungan seluruh objek terpilih. */
  const ratakan = (arah: Arah) => {
    const daftar = selection
      .map((id) => readNode(doc, id))
      .filter((n): n is SceneNode => !!n && !n.locked)
    if (daftar.length < 2) return

    const kiri = Math.min(...daftar.map((n) => n.x))
    const kanan = Math.max(...daftar.map((n) => n.x + n.w))
    const atas = Math.min(...daftar.map((n) => n.y))
    const bawah = Math.max(...daftar.map((n) => n.y + n.h))

    doc.transact(() => {
      for (const n of daftar) {
        if (arah === 'kiri') updateNode(doc, n.id, { x: kiri })
        else if (arah === 'kanan') updateNode(doc, n.id, { x: kanan - n.w })
        else if (arah === 'tengahH') updateNode(doc, n.id, { x: (kiri + kanan) / 2 - n.w / 2 })
        else if (arah === 'atas') updateNode(doc, n.id, { y: atas })
        else if (arah === 'bawah') updateNode(doc, n.id, { y: bawah - n.h })
        else updateNode(doc, n.id, { y: (atas + bawah) / 2 - n.h / 2 })
      }
    })
  }

  const BarisRata = () => (
    <div className="flex items-center gap-0.5">
      {(['kiri', 'tengahH', 'kanan'] as Arah[]).map((a) => (
        <TombolIkon key={a} title={`Ratakan ${a}`} onClick={() => ratakan(a)}><IkonRata arah={a} /></TombolIkon>
      ))}
      <span style={{ width: 6 }} />
      {(['atas', 'tengahV', 'bawah'] as Arah[]).map((a) => (
        <TombolIkon key={a} title={`Ratakan ${a}`} onClick={() => ratakan(a)}><IkonRata arah={a} /></TombolIkon>
      ))}
    </div>
  )

  if (selection.length === 0) {
    return (
      <aside style={kerangka} className="p-3">
        <p style={{ color: 'var(--text-2)', fontSize: 12 }}>Tidak ada yang dipilih</p>
      </aside>
    )
  }

  /* Banyak objek terpilih: perataan justru paling berguna di sini. */
  if (!satu || !node) {
    return (
      <aside style={kerangka} className="overflow-y-auto">
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
          <p style={{ color: 'var(--text-1)', fontSize: 12 }}>{selection.length} objek terpilih</p>
        </div>
        <Bagian judul="Perataan" kolom={1}>
          <BarisRata />
        </Bagian>
      </aside>
    )
  }

  const set = (patch: Partial<SceneNode>) => updateNode(doc, node.id, patch)
  const rasio = node.h === 0 ? 1 : node.w / node.h

  return (
    <aside style={kerangka} className="overflow-y-auto">
      {/* Kepala — jenis objek, sembunyikan, kunci */}
      <div
        className="flex items-center gap-1"
        style={{ padding: '9px 12px', borderBottom: '1px solid var(--line)' }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0 }} className="truncate">
          {node.name || DEFAULT_NAME[node.type]}
        </span>
        <TombolIkon
          title={node.visible ? 'Sembunyikan' : 'Tampilkan'}
          onClick={() => set({ visible: !node.visible })}
          aktif={!node.visible}
        >
          {node.visible ? <Eye size={13} strokeWidth={1.5} /> : <EyeOff size={13} strokeWidth={1.5} />}
        </TombolIkon>
        <TombolIkon
          title={node.locked ? 'Buka kunci' : 'Kunci'}
          onClick={() => set({ locked: !node.locked })}
          aktif={node.locked}
        >
          {node.locked ? <Lock size={13} strokeWidth={1.5} /> : <Unlock size={13} strokeWidth={1.5} />}
        </TombolIkon>
      </div>

      {node.type === 'text' && (
        <Bagian judul="Isi Teks" kolom={1}>
          <TextEditor doc={doc} node={node} />
        </Bagian>
      )}

      <Bagian judul="Perataan" kolom={1}>
        <BarisRata />
      </Bagian>

      <Bagian judul="Posisi">
        <NumField label="X" value={node.x} onCommit={(x) => set({ x })} />
        <NumField label="Y" value={node.y} onCommit={(y) => set({ y })} />
        <NumField label="∠" value={node.rotation} onCommit={(rotation) => set({ rotation })} />
      </Bagian>

      <Bagian
        judul="Ukuran"
        aksi={
          <TombolIkon
            title={kunciRasio ? 'Lepas kunci perbandingan' : 'Kunci perbandingan'}
            onClick={() => setKunciRasio((v) => !v)}
            aktif={kunciRasio}
          >
            {kunciRasio ? <Link2 size={12} strokeWidth={1.5} /> : <Unlink2 size={12} strokeWidth={1.5} />}
          </TombolIkon>
        }
      >
        <NumField
          label="W"
          value={node.w}
          onCommit={(w) => {
            const lebar = Math.max(1, w)
            set(kunciRasio ? { w: lebar, h: Math.max(1, lebar / rasio) } : { w: lebar })
          }}
        />
        <NumField
          label="H"
          value={node.h}
          onCommit={(h) => {
            const tinggi = Math.max(1, h)
            set(kunciRasio ? { h: tinggi, w: Math.max(1, tinggi * rasio) } : { h: tinggi })
          }}
        />
      </Bagian>

      {(node.type === 'polygon' || node.type === 'star') && (
        <Bagian judul={node.type === 'star' ? 'Bintang' : 'Poligon'}>
          <NumField
            label={node.type === 'star' ? 'Sudut' : 'Sisi'}
            value={jumlahSisi(node)}
            onCommit={(sides) =>
              set({ sides: Math.min(SISI_MAKS, Math.max(SISI_MIN, Math.round(sides))) })
            }
          />
        </Bagian>
      )}

      <Bagian judul="Tampilan">
        {/* Kepekatan ditulis dalam persen — 0 sampai 1 sulit dibaca cepat. */}
        <NumField
          label="%"
          step={5}
          value={Math.round(node.opacity * 100)}
          onCommit={(v) => set({ opacity: Math.min(1, Math.max(0, v / 100)) })}
        />
        <NumField
          label="⌒"
          value={node.radius}
          onCommit={(radius) => set({ radius: Math.max(0, radius) })}
        />
      </Bagian>

      <Bagian judul="Isi" kolom={1}>
        <ColorField label="F" value={node.fill} onCommit={(fill) => set({ fill })} />
      </Bagian>

      <Bagian judul="Garis">
        <ColorField label="S" value={node.stroke} onCommit={(stroke) => set({ stroke })} />
        <NumField
          label="W"
          value={node.strokeWidth}
          onCommit={(strokeWidth) => set({ strokeWidth: Math.max(0, strokeWidth) })}
        />
      </Bagian>
    </aside>
  )
}
