'use client'

import { useState } from 'react'
import type * as Y from 'yjs'
import { Eye, EyeOff, Lock, Unlock, Link2, Unlink2 } from 'lucide-react'
import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import { readNode, updateNode } from '@/kanvas/doc/nodes'
import type { SceneNode } from '@/kanvas/doc/types'
import { DEFAULT_NAME } from '@/kanvas/doc/types'
import { ColorField, NumField, SelectField } from './Field'
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

  /* Ratakan JARAK: menyamakan celah antar objek, bukan tepinya.
     Objek pertama dan terakhir tetap di tempatnya — itu yang membuat
     hasilnya terduga; kalau semuanya ikut bergerak, susunan yang sudah
     benar di tepi malah rusak. Butuh minimal 3 objek: dengan 2 objek
     tidak ada celah di tengah untuk disamakan. */
  const ratakanJarak = (sumbu: 'x' | 'y') => {
    const daftar = selection
      .map((id) => readNode(doc, id))
      .filter((n): n is SceneNode => !!n && !n.locked)
    if (daftar.length < 3) return

    const sisi = sumbu === 'x' ? 'w' : 'h'
    const urut = [...daftar].sort((a, b) => a[sumbu] - b[sumbu])

    const awal = urut[0][sumbu]
    const akhir = urut[urut.length - 1][sumbu] + urut[urut.length - 1][sisi]
    const isi = urut.reduce((t, n) => t + n[sisi], 0)
    // Celah bisa negatif kalau objeknya saling tumpang tindih. Dibiarkan
    // apa adanya supaya jaraknya tetap seragam, bukan dipaksa nol.
    const celah = (akhir - awal - isi) / (urut.length - 1)

    doc.transact(() => {
      let jalan = awal
      for (const n of urut) {
        updateNode(doc, n.id, { [sumbu]: Math.round(jalan) } as Partial<SceneNode>)
        jalan += n[sisi] + celah
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
      <span style={{ width: 6 }} />
      {/* Ratakan jarak. Nonaktif di bawah 3 objek — dengan 2 objek tidak
          ada celah di tengah yang bisa disamakan. */}
      <TombolIkon
        title={selection.length < 3 ? 'Ratakan jarak — butuh 3 objek atau lebih' : 'Ratakan jarak mendatar'}
        onClick={() => ratakanJarak('x')}
      >
        <span style={{ fontSize: 12, lineHeight: 1, opacity: selection.length < 3 ? 0.35 : 1 }}>⇹</span>
      </TombolIkon>
      <TombolIkon
        title={selection.length < 3 ? 'Ratakan jarak — butuh 3 objek atau lebih' : 'Ratakan jarak tegak'}
        onClick={() => ratakanJarak('y')}
      >
        <span style={{ fontSize: 12, lineHeight: 1, opacity: selection.length < 3 ? 0.35 : 1 }}>⇳</span>
      </TombolIkon>
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
        {/* Nama bisa langsung disunting di sini. Sebelumnya hanya bisa
            lewat klik-ganda di panel Layer — tersembunyi, dan untuk frame
            yang berperan sebagai section, namanya justru tampil di kanvas
            jadi harus mudah diganti. */}
        <input
          defaultValue={node.name || DEFAULT_NAME[node.type]}
          key={node.id}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'transparent'
            const nama = e.currentTarget.value.trim()
            if (nama && nama !== node.name) set({ name: nama })
            else e.currentTarget.value = node.name || DEFAULT_NAME[node.type]
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.currentTarget.value = node.name || DEFAULT_NAME[node.type]
              e.currentTarget.blur()
            }
          }}
          title="Klik untuk mengganti nama"
          style={{
            fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0,
            background: 'transparent', border: '1px solid transparent',
            borderRadius: 'var(--radius)', color: 'var(--text-0)',
            padding: '2px 4px', outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.select() }}
        />
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

      {(node.type === 'text' || node.type === 'sticky') && (
        <Bagian judul={node.type === 'sticky' ? 'Isi Catatan' : 'Isi Teks'} kolom={1}>
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

      {/* Tipografi — hanya untuk node yang memang berisi teks. Muncul di
          sini, bukan di dekat isi teks, supaya urutannya sama dengan
          editor grafis lain: isi dulu, baru bentuknya. */}
      {(node.type === 'text' || node.type === 'sticky') && (
        <Bagian judul="Tipografi">
          <SelectField
            label="A"
            value={node.fontFamily || 'var(--font-ui), sans-serif'}
            options={[
              { nilai: 'var(--font-ui), sans-serif', label: 'Bawaan' },
              { nilai: 'Inter, system-ui, sans-serif', label: 'Inter' },
              { nilai: 'Georgia, serif', label: 'Georgia' },
              { nilai: '"Times New Roman", serif', label: 'Times' },
              { nilai: '"Courier New", monospace', label: 'Courier' },
              { nilai: 'Verdana, sans-serif', label: 'Verdana' },
            ]}
            onCommit={(fontFamily) => set({ fontFamily })}
          />
          <NumField
            label="S"
            value={node.fontSize || (node.type === 'sticky' ? 14 : 16)}
            onCommit={(v) => set({ fontSize: Math.min(200, Math.max(6, v)) })}
          />
          <SelectField
            label="W"
            value={String(node.fontWeight || 400)}
            options={[
              { nilai: '300', label: 'Tipis' },
              { nilai: '400', label: 'Biasa' },
              { nilai: '600', label: 'Medium' },
              { nilai: '700', label: 'Tebal' },
              { nilai: '900', label: 'Berat' },
            ]}
            onCommit={(v) => set({ fontWeight: Number(v) })}
          />
          <SelectField
            label="≡"
            value={node.align || 'left'}
            options={[
              { nilai: 'left', label: 'Kiri' },
              { nilai: 'center', label: 'Tengah' },
              { nilai: 'right', label: 'Kanan' },
            ]}
            onCommit={(v) => set({ align: v as 'left' | 'center' | 'right' })}
          />
        </Bagian>
      )}

      {/* Cermin. Dipisah dari Perataan karena yang ini mengubah objeknya,
          bukan menata letaknya terhadap objek lain. */}
      <Bagian judul="Cermin" kolom={1}>
        <div className="flex gap-1.5">
          <TombolIkon
            title="Cermin mendatar"
            onClick={() => set({ flipX: !node.flipX })}
            aktif={!!node.flipX}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>⇄</span>
          </TombolIkon>
          <TombolIkon
            title="Cermin tegak"
            onClick={() => set({ flipY: !node.flipY })}
            aktif={!!node.flipY}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>⇅</span>
          </TombolIkon>
        </div>
      </Bagian>

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
