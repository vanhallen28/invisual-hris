'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/kanvas/lib/supabase'
import type { SceneNode } from '@/kanvas/doc/types'

const cache = new Map<string, string>()

export function ImageShape({ node, transform }: { node: SceneNode; transform?: string }) {
  const [url, setUrl] = useState<string | null>(
    node.assetId ? (cache.get(node.assetId) ?? null) : null
  )

  useEffect(() => {
    const id = node.assetId
    if (!id || cache.has(id)) return
    let batal = false

    createBrowserSupabase()
      .storage.from('assets')
      .createSignedUrl(id, 3600)
      .then(({ data }) => {
        if (batal || !data?.signedUrl) return
        cache.set(id, data.signedUrl)
        setUrl(data.signedUrl)
      })

    return () => {
      batal = true
    }
  }, [node.assetId])

  // Placeholder memakai geometri yang sama, sehingga hit-test dan
  // handle seleksi tetap benar selama URL sedang diambil.
  if (!url) {
    return (
      <rect
        x={node.x} y={node.y} width={node.w} height={node.h}
        fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth={1}
        transform={transform} opacity={node.opacity}
      />
    )
  }

  return (
    <image
      href={url}
      x={node.x} y={node.y} width={node.w} height={node.h}
      transform={transform} opacity={node.opacity}
      preserveAspectRatio="xMidYMid slice"
    />
  )
}
