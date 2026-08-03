'use client'

import { memo } from 'react'
import { useNode, useNodeIds } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import type { Viewport } from '@/kanvas/state/viewport'
import { worldToScreen } from '@/kanvas/state/viewport'

/**
 * Judul frame yang tampil di atas kotaknya — "section berjudul" ala FigJam.
 *
 * KENAPA LAPISAN TERPISAH, BUKAN DI DALAM Shape
 * Seluruh isi kanvas digambar di dalam <g transform="scale(zoom)">, jadi apa
 * pun yang ada di sana ikut mengecil saat di-zoom keluar. Pada 24% — zoom
 * yang memang dipakai untuk melihat papan besar — teks 12px jadi 3px dan
 * tak terbaca.
 *
 * Menyuntikkan `zoom` ke dalam Shape juga bukan jawaban: NodeView memakai
 * memo per-node supaya menggeser satu objek tidak menggambar ulang seluruh
 * kanvas. Prop yang berubah tiap langkah zoom akan mematahkan itu untuk
 * SEMUA node sekaligus.
 *
 * Jadi label digambar di koordinat LAYAR, di luar grup berskala. Ukurannya
 * tetap berapa pun zoom-nya, dan memo per-node tidak tersentuh.
 */

const UkuranTeks = 11

const SatuLabel = memo(function SatuLabel({
  store,
  id,
  viewport,
}: {
  store: DocStore
  id: string
  viewport: Viewport
}) {
  const node = useNode(store, id)
  if (!node || node.type !== 'frame' || !node.visible) return null

  const nama = (node.name || '').trim()
  if (!nama) return null

  const p = worldToScreen(viewport, node.x, node.y)

  return (
    <text
      x={p.x}
      // 6px di atas tepi frame, cukup untuk tidak menyentuh garisnya.
      y={p.y - 6}
      fill="var(--text-2)"
      style={{ font: `600 ${UkuranTeks}px var(--font-ui), sans-serif` }}
      // Label murni penanda. Tanpa ini, mengklik judul justru meleset dari
      // frame-nya dan seleksi terasa rusak.
      pointerEvents="none"
    >
      {nama.length > 42 ? `${nama.slice(0, 42)}…` : nama}
    </text>
  )
})

export function FrameLabels({
  store,
  viewport,
  page,
  pageAwal,
}: {
  store: DocStore
  viewport: Viewport
  page?: string
  pageAwal?: string
}) {
  const semua = useNodeIds(store)

  // Penyaringan halaman disamakan dengan Scene: label halaman lain tidak
  // boleh ikut menempel di halaman yang sedang dibuka.
  const ids = page
    ? semua.filter((id) => (store.getNode(id)?.page || pageAwal) === page)
    : semua

  return (
    <>
      {ids.map((id) => (
        <SatuLabel key={id} store={store} id={id} viewport={viewport} />
      ))}
    </>
  )
}
