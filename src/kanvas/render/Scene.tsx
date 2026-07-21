'use client'

import type { ReactNode } from 'react'
import { useNodeIds } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import type { SceneNode } from '@/kanvas/doc/types'
import type { Viewport } from '@/kanvas/state/viewport'
import { NodeView } from './NodeView'

export function Scene({
  store,
  viewport,
  overlay,
  svgRef,
  preview,
  page,
  pageAwal,
  ...rest
}: {
  store: DocStore
  viewport: Viewport
  overlay?: ReactNode
  svgRef?: React.Ref<SVGSVGElement>
  preview?: Record<string, Partial<SceneNode>>
  /** Halaman yang sedang dibuka. Node halaman lain tidak digambar. */
  page?: string
  /** Halaman pertama, untuk node lama yang belum punya penanda halaman. */
  pageAwal?: string
} & React.SVGProps<SVGSVGElement>) {
  const semua = useNodeIds(store)
  const ids = page
    ? semua.filter((id) => (store.getNode(id)?.page || pageAwal) === page)
    : semua

  return (
    <svg
      ref={svgRef}
      className="canvas-surface h-full w-full"
      style={{ background: 'var(--void)' }}
      {...rest}
    >
      {/* scale lalu translate: titik dunia (wx,wy) mendarat di
          ((wx - vp.x) * zoom, ...), persis seperti worldToScreen. */}
      <g transform={`scale(${viewport.zoom}) translate(${-viewport.x} ${-viewport.y})`}>
        {ids.map((id) => (
          <NodeView key={id} store={store} id={id} override={preview?.[id]} />
        ))}
      </g>
      {overlay}
    </svg>
  )
}
