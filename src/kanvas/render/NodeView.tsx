'use client'

import { memo } from 'react'
import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import type { SceneNode } from '@/kanvas/doc/types'
import { Shape } from './shapes'

/**
 * Satu komponen per node, masing-masing berlangganan hanya pada
 * node miliknya. Menggeser satu objek me-render ulang satu
 * komponen ini saja.
 *
 * memo wajib. Ketika Scene me-render ulang karena daftar id
 * berubah, tanpa memo seluruh NodeView ikut ter-render meski
 * node-nya tidak tersentuh sama sekali.
 *
 * override berisi geometri pratinjau selama gestur. Node yang
 * tidak sedang digeser menerima undefined, yang referensinya
 * stabil, sehingga memo menahannya dari render ulang meski
 * Scene ter-render setiap frame.
 */
export const NodeView = memo(function NodeView({
  store,
  id,
  override,
  assetUrl,
}: {
  store: DocStore
  id: string
  override?: Partial<SceneNode>
  assetUrl?: string
}) {
  const node = useNode(store, id)
  if (!node) return null
  return <Shape node={override ? { ...node, ...override } : node} assetUrl={assetUrl} />
})
