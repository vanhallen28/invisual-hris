'use client'

import { useState } from 'react'
import type * as Y from 'yjs'
import { useNode, useNodeIds } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import { childrenOf } from '@/kanvas/doc/hierarchy'
import { readAllNodes, updateNode } from '@/kanvas/doc/nodes'
import { keyBetween } from '@/kanvas/doc/order'
import { ROOT, type SceneNode } from '@/kanvas/doc/types'

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
  doc, store, id, depth, terpilih, onSelect,
}: {
  doc: Y.Doc
  store: DocStore
  id: string
  depth: number
  terpilih: boolean
  onSelect: (id: string, shift: boolean) => void
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

  return (
    <div
      className="flex items-center gap-1 px-2 py-1"
      style={{
        paddingLeft: 8 + depth * 12,
        background: terpilih ? 'var(--accent-soft)' : 'transparent',
        color: node.visible ? 'var(--text-0)' : 'var(--text-2)',
        fontSize: 12,
      }}
    >
      <button
        className="flex-1 text-left"
        onClick={(e) => onSelect(node.id, e.shiftKey)}
        onDoubleClick={() => setSunting(true)}
        style={{ textDecoration: node.locked ? 'line-through' : undefined }}
      >
        {node.name}
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

  function pohon(induk: string, depth: number): React.ReactNode[] {
    // Dibalik supaya yang paling atas di kanvas tampil paling atas
    // di panel, sesuai kebiasaan editor grafis.
    return [...anakDari(induk)].reverse().flatMap((n) => [
      <Baris
        key={n.id}
        doc={doc}
        store={store}
        id={n.id}
        depth={depth}
        terpilih={selection.includes(n.id)}
        onSelect={onSelect}
      />,
      ...pohon(n.id, depth + 1),
    ])
  }

  return (
    <aside
      style={{ background: 'var(--surface-1)' }}
      className="flex-1 min-h-0 overflow-y-auto"
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
