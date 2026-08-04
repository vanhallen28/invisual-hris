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
  cropId = null,
  onCrop,
  onSelesaiCrop,
  onResetCrop,
  onPresetRasio,
  penEditId = null,
  onSuntingJalur,
  onSelesaiSunting,
  onHapusAnchor,
  idTeksBaru = null,
  onFokusTeksSelesai,
  cropIsiId = null,
  onPotongIsi,
  onSelesaiPotongIsi,
  onResetPotongIsi,
}: {
  doc: Y.Doc
  store: DocStore
  selection: string[]
  /** Node gambar yang sedang dipotong, atau null. Semua prop crop opsional. */
  cropId?: string | null
  onCrop?: (id: string) => void
  onSelesaiCrop?: () => void
  onResetCrop?: (id: string) => void
  onPresetRasio?: (id: string, rasio: number) => void
  /** Sunting jalur Pen. Semua opsional. */
  penEditId?: string | null
  onSuntingJalur?: (id: string) => void
  onSelesaiSunting?: () => void
  onHapusAnchor?: () => void
  /** Auto-fokus kolom teks untuk objek "Teks di jalur" yang baru dibuat. */
  idTeksBaru?: string | null
  onFokusTeksSelesai?: () => void
  /** Potong isi (crop) untuk node non-gambar. Semua opsional. */
  cropIsiId?: string | null
  onPotongIsi?: (id: string) => void
  onSelesaiPotongIsi?: () => void
  onResetPotongIsi?: (id: string) => void
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

  /* Membalik (cermin) SEMUA objek terpilih di tempat — sama seperti tombol
     Cermin objek tunggal, hanya diterapkan ke tiap objek. Toggle per objek:
     yang sudah terbalik kembali normal, jadi menekan dua kali = seperti semula. */
  const cerminSemua = (sumbu: 'x' | 'y') => {
    doc.transact(() => {
      for (const id of selection) {
        const n = readNode(doc, id)
        if (!n) continue
        updateNode(doc, id, sumbu === 'x' ? { flipX: !n.flipX } : { flipY: !n.flipY })
      }
    }, 'local')
  }

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
        <Bagian judul="Cermin" kolom={1}>
          <div className="flex gap-1.5">
            <TombolIkon title="Cermin mendatar (Shift+H)" onClick={() => cerminSemua('x')}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>⇄</span>
            </TombolIkon>
            <TombolIkon title="Cermin tegak (Shift+V)" onClick={() => cerminSemua('y')}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>⇅</span>
            </TombolIkon>
          </div>
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

      {(node.type === 'text' || node.type === 'sticky' || node.type === 'textpath') && (
        <Bagian judul={node.type === 'sticky' ? 'Isi Catatan' : 'Isi Teks'} kolom={1}>
          <TextEditor
            doc={doc}
            node={node}
            autoFokus={node.type === 'textpath' && node.id === idTeksBaru}
            onFokusSelesai={onFokusTeksSelesai}
          />
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

      {node.type === 'image' && cropId === node.id && (
        <Bagian judul="Rasio potong" kolom={5}>
          {([['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['9:16', 9 / 16]] as Array<[string, number]>).map(
            ([label, rasio]) => (
              <button
                key={label}
                type="button"
                onClick={() => onPresetRasio?.(node.id, rasio)}
                style={{
                  padding: '5px 2px', fontSize: 10, borderRadius: 6, cursor: 'pointer',
                  background: 'var(--surface-2)', color: 'var(--text-1)',
                  border: '1px solid var(--line-strong)',
                }}
              >
                {label}
              </button>
            )
          )}
        </Bagian>
      )}

      {node.type === 'image' && (
        <Bagian judul="Gambar" kolom={1}>
          {cropId === node.id ? (
            <>
              <button
                type="button"
                onClick={() => onSelesaiCrop?.()}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  cursor: 'pointer', background: 'var(--accent)', color: 'var(--void)',
                  border: '1px solid var(--accent)',
                }}
              >
                Selesai memotong
              </button>
              <button
                type="button"
                onClick={() => onResetCrop?.(node.id)}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  cursor: 'pointer', background: 'var(--surface-2)', color: 'var(--text-0)',
                  border: '1px solid var(--line-strong)',
                }}
              >
                Reset potong
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onCrop?.(node.id)}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  cursor: 'pointer', background: 'var(--surface-2)', color: 'var(--text-0)',
                  border: '1px solid var(--line-strong)',
                }}
              >
                Potong gambar
              </button>
              {node.crop && (
                <button
                  type="button"
                  onClick={() => onResetCrop?.(node.id)}
                  style={{
                    width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                    cursor: 'pointer', background: 'transparent', color: 'var(--text-1)',
                    border: '1px solid var(--line)',
                  }}
                >
                  Reset potong
                </button>
              )}
            </>
          )}
        </Bagian>
      )}

      {(node.type === 'pen' || node.type === 'textpath') && (
        <Bagian judul="Jalur" kolom={1}>
          {penEditId === node.id ? (
            <>
              <button
                type="button"
                onClick={() => onSelesaiSunting?.()}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  cursor: 'pointer', background: 'var(--accent)', color: 'var(--void)',
                  border: '1px solid var(--accent)',
                }}
              >
                Selesai menyunting
              </button>
              <button
                type="button"
                onClick={() => onHapusAnchor?.()}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  cursor: 'pointer', background: 'var(--surface-2)', color: 'var(--text-0)',
                  border: '1px solid var(--line-strong)',
                }}
              >
                Hapus titik terpilih
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSuntingJalur?.(node.id)}
              style={{
                width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                cursor: 'pointer', background: 'var(--surface-2)', color: 'var(--text-0)',
                border: '1px solid var(--line-strong)',
              }}
            >
              Sunting jalur
            </button>
          )}
        </Bagian>
      )}

      {node.type !== 'image' && (
        <Bagian judul="Potong isi" kolom={1}>
          {cropIsiId === node.id ? (
            <>
              <button
                type="button"
                onClick={() => onSelesaiPotongIsi?.()}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  cursor: 'pointer', background: 'var(--accent)', color: 'var(--void)',
                  border: '1px solid var(--accent)',
                }}
              >
                Selesai memotong
              </button>
              <button
                type="button"
                onClick={() => onResetPotongIsi?.(node.id)}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  cursor: 'pointer', background: 'var(--surface-2)', color: 'var(--text-0)',
                  border: '1px solid var(--line-strong)',
                }}
              >
                Reset potong
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onPotongIsi?.(node.id)}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  cursor: 'pointer', background: 'var(--surface-2)', color: 'var(--text-0)',
                  border: '1px solid var(--line-strong)',
                }}
              >
                Potong isi
              </button>
              {node.crop && (
                <button
                  type="button"
                  onClick={() => onResetPotongIsi?.(node.id)}
                  style={{
                    width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                    cursor: 'pointer', background: 'transparent', color: 'var(--text-1)',
                    border: '1px solid var(--line)',
                  }}
                >
                  Reset potong
                </button>
              )}
            </>
          )}
        </Bagian>
      )}

      {/* Tipografi — hanya untuk node yang memang berisi teks. Muncul di
          sini, bukan di dekat isi teks, supaya urutannya sama dengan
          editor grafis lain: isi dulu, baru bentuknya. */}
      {(node.type === 'text' || node.type === 'sticky' || node.type === 'textpath') && (
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
          {node.type === 'text' && (
            <>
              <SelectField
                label="⇕"
                value={node.valign || 'top'}
                options={[
                  { nilai: 'top', label: 'Atas' },
                  { nilai: 'middle', label: 'Tengah' },
                  { nilai: 'bottom', label: 'Bawah' },
                ]}
                onCommit={(v) => set({ valign: v as 'top' | 'middle' | 'bottom' })}
              />
              <SelectField
                label="↕"
                value={String(node.lineHeight || 1.2)}
                options={[
                  { nilai: '1', label: '1.0×' },
                  { nilai: '1.2', label: '1.2×' },
                  { nilai: '1.5', label: '1.5×' },
                  { nilai: '2', label: '2.0×' },
                ]}
                onCommit={(v) => set({ lineHeight: Number(v) })}
              />
              <NumField
                label="AV"
                value={node.letterSpacing || 0}
                onCommit={(v) => set({ letterSpacing: Math.min(40, Math.max(-10, v)) })}
              />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 4, marginTop: 2 }}>
                {([['auto-w', 'Auto ↔'], ['auto-h', 'Auto ↕'], ['fixed', 'Tetap']] as const).map(([m, lbl]) => {
                  const aktif = (node.resize || 'auto-w') === m
                  return (
                    <button
                      key={m}
                      type="button"
                      title={m === 'auto-w' ? 'Lebar mengikuti teks' : m === 'auto-h' ? 'Tinggi mengikuti teks (lebar tetap)' : 'Ukuran tetap, teks dibungkus'}
                      onClick={() => set({ resize: m })}
                      style={{
                        flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                        background: aktif ? 'var(--accent)' : 'var(--surface-2)',
                        color: aktif ? 'var(--void)' : 'var(--text-1)',
                        border: `1px solid ${aktif ? 'var(--accent)' : 'var(--line)'}`,
                      }}
                    >
                      {lbl}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </Bagian>
      )}

      {/* Cermin. Dipisah dari Perataan karena yang ini mengubah objeknya,
          bukan menata letaknya terhadap objek lain. */}
      <Bagian judul="Cermin" kolom={1}>
        <div className="flex gap-1.5">
          <TombolIkon
            title="Cermin mendatar (Shift+H)"
            onClick={() => set({ flipX: !node.flipX })}
            aktif={!!node.flipX}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>⇄</span>
          </TombolIkon>
          <TombolIkon
            title="Cermin tegak (Shift+V)"
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
