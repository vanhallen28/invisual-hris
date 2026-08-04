'use client'

import { memo, type ReactNode } from 'react'
import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import type { SceneNode } from '@/kanvas/doc/types'
import { Shape } from './shapes'
import { cropIsiBerlaku, bungkusCropIsiKlip, transformCropIsi } from './cropIsi'

/**
 * Satu komponen per node, masing-masing berlangganan hanya pada node miliknya
 * (dan pada INDUKNYA, agar bisa ikut terklip/tertransform bila induknya grup
 * ber-crop).
 *
 * memo wajib: saat Scene me-render ulang karena daftar id berubah, tanpa memo
 * seluruh NodeView ikut ter-render meski node-nya tak tersentuh.
 */
export const NodeView = memo(function NodeView({
  store,
  id,
  override,
  assetUrl,
  tanpaKlipId,
}: {
  store: DocStore
  id: string
  override?: Partial<SceneNode>
  assetUrl?: string
  /** Node/grup yang sedang dipotong — dirender TANPA klip agar isinya tampak penuh. */
  tanpaKlipId?: string | null
}) {
  const node = useNode(store, id)
  // '' = tak ada induk (getNode mengembalikan null). Hook tetap dipanggil.
  const induk = useNode(store, node?.parent ?? '')
  if (!node) return null

  const el: ReactNode = <Shape node={override ? { ...node, ...override } : node} assetUrl={assetUrl} />

  const c = cropIsiBerlaku(node, induk)
  if (!c) return el

  // Saat sedang dipotong: transform SAJA (agar geser/skala isi terlihat hidup),
  // TANPA klip — isi tampak penuh; overlay yang menandai jendela & meredupkan luar.
  const dipotong = tanpaKlipId != null && (id === tanpaKlipId || node.parent === tanpaKlipId)
  if (dipotong) {
    return <g transform={transformCropIsi(c.kotak, c.crop)}>{el}</g>
  }

  return bungkusCropIsiKlip(el, c.crop, c.kotak, c.cid)
})
