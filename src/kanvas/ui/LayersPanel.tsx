'use client'

import { useState } from 'react'
import type * as Y from 'yjs'
import { useNode, useNodeIds } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import { childrenOf, reparent, keturunanDari } from '@/kanvas/doc/hierarchy'
import { readAllNodes, updateNode } from '@/kanvas/doc/nodes'
import { keyBetween } from '@/kanvas/doc/order'
import { ROOT, DEFAULT_NAME, type SceneNode } from '@/kanvas/doc/types'
import {
  Frame, Square, Circle, Minus, MoveUpRight, Triangle, Star, Type,
  Image as ImageIcon, MessageSquare, PenLine, PenTool, Spline, Group as GroupIcon, ChevronRight,
} from 'lucide-react'

type IkonKomp = React.ComponentType<{ size?: number }>
// Ikon tipe objek untuk sisi kiri tiap baris layer (identik dgn Toolbar).
const IKON_TIPE: Record<string, IkonKomp> = {
  frame: Frame, rect: Square, ellipse: Circle, line: Minus, arrow: MoveUpRight,
  polygon: Triangle, star: Star, text: Type, image: ImageIcon, group: GroupIcon,
  sticky: MessageSquare, draw: PenLine, pen: PenTool, textpath: Spline,
}

/** Naikkan atau turunkan satu tingkat di antara saudaranya. */
function geserUrutan(doc: Y.Doc, node: SceneNode, arah: 1 | -1) {
  const saudara = childrenOf(doc, node.parent)
  const i = saudara.findIndex((n) => n.id === node.id)
  const j = i + arah
  if (j < 0 || j >= saudara.length) return

  // Sisipkan di antara tetangga tujuan dan tetangga di baliknya.
  const tujuan = saudara[j]
  const seberang = saudara[j + arah]
  const kunci =
    arah === 1
      ? keyBetween(tujuan.order, seberang ? seberang.order : null)
      : keyBetween(seberang ? seberang.order : null, tujuan.order)

  updateNode(doc, node.id, { order: kunci })
}

function Baris({
  doc, store, id, depth, terpilih, onSelect, punyaAnak, terTutup, onToggle,
  onSeretMulai, onSeretAtas, onJatuh, onSeretSelesai, seretId, atasInfo,
}: {
  doc: Y.Doc
  store: DocStore
  id: string
  depth: number
  terpilih: boolean
  onSelect: (id: string, shift: boolean) => void
  /** Apakah node ini punya anak (wadah) — untuk menampilkan panah lipat. */
  punyaAnak: boolean
  terTutup: boolean
  onToggle: () => void
  onSeretMulai: (id: string) => void
  onSeretAtas: (id: string, pos: 'atas' | 'bawah' | 'dalam') => void
  onJatuh: (id: string) => void
  onSeretSelesai: () => void
  seretId: string | null
  atasInfo: { id: string; pos: 'atas' | 'bawah' | 'dalam' } | null
}) {
  // Berlangganan per-node, bukan menerima node sebagai props.
  // Daftar id tidak disiarkan saat properti berubah, jadi baris
  // yang menerima props tidak akan pernah menggambar ulang saat
  // tombol mata atau gembok ditekan.
  const node = useNode(store, id)
  // useState wajib berada di atas early-return: memanggil hook setelah
  // `if (!node) return null` melanggar aturan hook karena urutan hook
  // akan berubah begitu node muncul atau hilang.
  const [sunting, setSunting] = useState(false)
  if (!node) return null

  if (sunting) {
    return (
      <div className="px-2 py-1" style={{ paddingLeft: 8 + depth * 12 }}>
        <input
          autoFocus
          defaultValue={node.name}
          onBlur={(e) => {
            const nama = e.target.value.trim()
            if (nama) updateNode(doc, node.id, { name: nama })
            setSunting(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setSunting(false)
          }}
          className="w-full"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-0)',
            padding: '1px 4px',
            fontSize: 12,
          }}
        />
      </div>
    )
  }

  // Nama layer teks otomatis mengikuti isi teks (kecuali sudah diberi nama sendiri).
  const def = DEFAULT_NAME[node.type as keyof typeof DEFAULT_NAME] ?? 'Objek'
  const isTeks = node.type === 'text' || node.type === 'textpath'
  const namaKustom = !!node.name && node.name !== def
  const teksIsi = node.text?.trim()
  const labelTampil = isTeks && !namaKustom && teksIsi ? teksIsi.slice(0, 40) : (node.name || def)
  const Ikon = IKON_TIPE[node.type] ?? Square

  return (
    <div
      className="flex items-center gap-1 px-2 py-1"
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onSeretMulai(node.id) }}
      onDragOver={(e) => {
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - r.top
        const wadah = node.type === 'frame' || node.type === 'group'
        const pos: 'atas' | 'bawah' | 'dalam' = wadah
          ? (y < r.height * 0.28 ? 'atas' : y > r.height * 0.72 ? 'bawah' : 'dalam')
          : (y < r.height * 0.5 ? 'atas' : 'bawah')
        onSeretAtas(node.id, pos)
      }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onJatuh(node.id) }}
      onDragEnd={onSeretSelesai}
      style={{
        paddingLeft: 8 + depth * 12,
        background:
          atasInfo?.id === node.id && atasInfo.pos === 'dalam' && seretId !== node.id
            ? 'var(--accent-soft)'
            : terpilih ? 'var(--accent-soft)' : 'transparent',
        boxShadow:
          atasInfo?.id === node.id && seretId !== node.id
            ? atasInfo.pos === 'dalam'
              ? 'inset 0 0 0 1px var(--accent)'
              : atasInfo.pos === 'atas'
                ? 'inset 0 2px 0 0 var(--accent)'
                : 'inset 0 -2px 0 0 var(--accent)'
            : undefined,
        color: node.visible ? 'var(--text-0)' : 'var(--text-2)',
        fontSize: 12,
        cursor: 'grab',
      }}
    >
      {punyaAnak ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          title={terTutup ? 'Buka' : 'Tutup'}
          style={{ display: 'flex', flexShrink: 0, color: 'var(--text-2)' }}
        >
          <ChevronRight
            size={12}
            style={{ transform: terTutup ? 'none' : 'rotate(90deg)', transition: 'transform .1s' }}
          />
        </button>
      ) : (
        <span style={{ width: 12, flexShrink: 0 }} />
      )}
      <span style={{ color: 'var(--text-2)', display: 'flex', flexShrink: 0 }}>
        <Ikon size={13} />
      </span>
      <button
        className="flex-1 text-left truncate"
        onClick={(e) => onSelect(node.id, e.shiftKey)}
        onDoubleClick={() => setSunting(true)}
        style={{ textDecoration: node.locked ? 'line-through' : undefined }}
      >
        {labelTampil}
      </button>

      <button
        title="Naikkan"
        onClick={() => geserUrutan(doc, node, 1)}
        style={{ color: 'var(--text-2)' }}
      >
        ↑
      </button>
      <button
        title="Turunkan"
        onClick={() => geserUrutan(doc, node, -1)}
        style={{ color: 'var(--text-2)' }}
      >
        ↓
      </button>
      <button
        title={node.visible ? 'Sembunyikan' : 'Tampilkan'}
        onClick={() => updateNode(doc, node.id, { visible: !node.visible })}
        style={{ color: 'var(--text-2)' }}
      >
        {node.visible ? '◉' : '○'}
      </button>
      <button
        title={node.locked ? 'Buka kunci' : 'Kunci'}
        onClick={() => updateNode(doc, node.id, { locked: !node.locked })}
        style={{ color: 'var(--text-2)' }}
      >
        {node.locked ? '▪' : '▫'}
      </button>
    </div>
  )
}

export function LayersPanel({
  doc, store, selection, onSelect, page, pageAwal,
}: {
  doc: Y.Doc
  store: DocStore
  selection: string[]
  onSelect: (id: string, shift: boolean) => void
  /** Halaman yang sedang dibuka. */
  page?: string
  /** Halaman pertama, untuk node lama tanpa penanda halaman. */
  pageAwal?: string
}) {
  // Berlangganan daftar id supaya penambahan, penghapusan, dan
  // perubahan urutan memicu penggambaran ulang pohon.
  useNodeIds(store)

  // Hanya node halaman aktif yang masuk pohon. Node lama tanpa penanda
  // halaman ikut halaman pertama, supaya kanvas lama tetap terbaca.
  const semuaNode = readAllNodes(doc)
  const semua = page ? semuaNode.filter((n) => (n.page || pageAwal) === page) : semuaNode
  const anakDari = (induk: string) => semua.filter((n) => n.parent === induk)

  // Wadah (frame/grup) yang sedang dilipat di panel — anaknya disembunyikan.
  const [tutup, setTutup] = useState<Set<string>>(() => new Set())
  const toggleTutup = (id: string) =>
    setTutup((lama) => {
      const baru = new Set(lama)
      if (baru.has(id)) baru.delete(id)
      else baru.add(id)
      return baru
    })

  // Seret-untuk-menyusun: tarik satu layer ke atas layer Frame/Grup untuk
  // menjadikannya ANAK; ke layer biasa → pindah ke level yang sama; ke area
  // kosong panel → keluar ke root.
  const [seret, setSeret] = useState<string | null>(null)
  const [atas, setAtas] = useState<{ id: string; pos: 'atas' | 'bawah' | 'dalam' } | null>(null)
  const onSeretSelesai = () => { setSeret(null); setAtas(null) }
  const onJatuh = (targetId: string) => {
    const dragId = seret
    const info = atas
    onSeretSelesai()
    if (!dragId || dragId === targetId) return
    const target = store.getNode(targetId)
    if (!target) return
    const pos = info?.id === targetId ? info.pos : 'bawah'
    // Tengah baris wadah = MASUK ke frame/grup.
    if (pos === 'dalam' && (target.type === 'frame' || target.type === 'group')) {
      try { reparent(doc, dragId, targetId) } catch { /* siklus — abaikan */ }
      return
    }
    // Atas/bawah = SUSUN-ULANG: sisip sebelum/sesudah target di induk target.
    const parent = target.parent ?? ROOT
    if (parent !== ROOT && keturunanDari(doc, [dragId]).includes(parent)) return
    const saudara = childrenOf(doc, parent).filter((n: any) => n.id !== dragId)
    const i = saudara.findIndex((n: any) => n.id === targetId)
    if (i < 0) return
    const orderBaru =
      pos === 'atas'
        ? keyBetween(saudara[i].order, saudara[i + 1]?.order ?? null)
        : keyBetween(saudara[i - 1]?.order ?? null, saudara[i].order)
    try { updateNode(doc, dragId, { parent, order: orderBaru }) } catch { /* abaikan */ }
  }

  function pohon(induk: string, depth: number): React.ReactNode[] {
    // Dibalik supaya yang paling atas di kanvas tampil paling atas
    // di panel, sesuai kebiasaan editor grafis.
    return [...anakDari(induk)].reverse().flatMap((n) => {
      const anak = anakDari(n.id)
      const ada = anak.length > 0
      const terTutup = tutup.has(n.id)
      return [
        <Baris
          key={n.id}
          doc={doc}
          store={store}
          id={n.id}
          depth={depth}
          terpilih={selection.includes(n.id)}
          onSelect={onSelect}
          punyaAnak={ada}
          terTutup={terTutup}
          onToggle={() => toggleTutup(n.id)}
          onSeretMulai={setSeret}
          onSeretAtas={(id, pos) => setAtas({ id, pos })}
          onJatuh={onJatuh}
          onSeretSelesai={onSeretSelesai}
          seretId={seret}
          atasInfo={atas}
        />,
        ...(ada && !terTutup ? pohon(n.id, depth + 1) : []),
      ]
    })
  }

  return (
    <aside
      style={{ background: 'var(--surface-1)' }}
      className="flex-1 min-h-0 overflow-y-auto"
      onDragOver={(e) => { if (seret) e.preventDefault() }}
      onDrop={(e) => {
        e.preventDefault()
        const dragId = seret
        onSeretSelesai()
        if (dragId) { try { reparent(doc, dragId, ROOT) } catch { /* abaikan */ } }
      }}
    >
      <h3
        style={{
          color: 'var(--text-2)', fontSize: 10, letterSpacing: '0.08em',
          textTransform: 'uppercase', padding: '10px 12px 6px',
        }}
      >
        Layer
      </h3>
      {semua.length === 0 ? (
        <p style={{ color: 'var(--text-2)', fontSize: 12, padding: '0 12px' }}>Kosong</p>
      ) : (
        pohon(ROOT, 0)
      )}
    </aside>
  )
}
