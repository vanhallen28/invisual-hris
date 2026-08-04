'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/kanvas/lib/supabase'
import type { SceneNode } from '@/kanvas/doc/types'

/* URL bertanda tangan punya masa berlaku. Dulu 1 jam dan hasilnya
   disimpan selamanya di cache — kanvas yang dibiarkan terbuka lebih dari
   sejam berubah jadi ikon gambar rusak, dan tetap rusak karena cache
   memegang URL kedaluwarsa. Sekarang berlaku 24 jam DAN cache dibuang
   begitu sebuah gambar gagal dimuat, supaya bisa diambil ulang. */
const MASA_BERLAKU = 24 * 3600
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
      .createSignedUrl(id, MASA_BERLAKU)
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

  const bereskanGagalMuat = () => {
    // URL kedaluwarsa atau gagal. Buang dari cache lalu minta ulang,
    // bukan membiarkan ikon rusak menetap sampai halaman dimuat ulang.
    if (node.assetId) cache.delete(node.assetId)
    setUrl(null)
  }

  if (node.crop) {
    return (
      <GambarTerpotong node={node} url={url} transform={transform} onError={bereskanGagalMuat} />
    )
  }

  return (
    <image
      href={url}
      x={node.x} y={node.y} width={node.w} height={node.h}
      transform={transform} opacity={node.opacity}
      // 'meet' menjaga seluruh isi gambar terlihat. 'slice' yang dipakai
      // sebelumnya MEMOTONG sisi yang tidak sebanding dengan kotaknya —
      // itu sebabnya hasil impor SVG tampak terpangkas.
      preserveAspectRatio="xMidYMid meet"
      onError={bereskanGagalMuat}
    />
  )
}

/**
 * Gambar terpotong: gambar penuh digambar pada rect crop lalu di-clip ke kotak
 * node. Dipakai bersama oleh render kanvas (ImageShape) dan ekspor (shapes),
 * supaya potongan otomatis ikut ke PNG/SVG. `id` clip diturunkan dari id node
 * agar unik saat banyak gambar dirender ke satu SVG.
 *
 * `preserveAspectRatio="none"` aman: rect crop sudah berasio gambar asli
 * (dijaga oleh interaksi crop), jadi gambar mengisi rect tanpa distorsi.
 */
export function GambarTerpotong({
  node,
  url,
  transform,
  onError,
}: {
  node: SceneNode
  url: string
  transform?: string
  onError?: () => void
}) {
  const c = node.crop!
  const Rx = node.x + c.ix * node.w
  const Ry = node.y + c.iy * node.h
  const Rw = c.iw * node.w
  const Rh = c.ih * node.h
  const cid = `crop-${node.id}`

  return (
    <g transform={transform} opacity={node.opacity}>
      <clipPath id={cid}>
        <rect x={node.x} y={node.y} width={node.w} height={node.h} />
      </clipPath>
      <image
        href={url}
        x={Rx} y={Ry} width={Rw} height={Rh}
        preserveAspectRatio="none"
        clipPath={`url(#${cid})`}
        onError={onError}
      />
    </g>
  )
}
