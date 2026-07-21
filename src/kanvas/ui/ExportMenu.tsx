'use client'

import { useState } from 'react'
import type * as Y from 'yjs'
import { boundsOf } from '@/kanvas/doc/bounds'
import { readAllNodes } from '@/kanvas/doc/nodes'
import type { SceneNode } from '@/kanvas/doc/types'
import { createBrowserSupabase } from '@/kanvas/lib/supabase'
import { frameKeSvg, siapkanAsetDataUrl } from '@/kanvas/features/export/toSvg'
import { svgKePng } from '@/kanvas/features/export/toPng'

function unduh(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  URL.revokeObjectURL(url)
}

/** Node di dalam subtree frame, plus frame itu sendiri. */
function subtree(semua: SceneNode[], akar: string) {
  const ikut = new Set([akar])
  let tambah = true
  while (tambah) {
    tambah = false
    for (const n of semua) {
      if (!ikut.has(n.id) && ikut.has(n.parent)) {
        ikut.add(n.id)
        tambah = true
      }
    }
  }
  return semua.filter((n) => ikut.has(n.id))
}

export function ExportMenu({
  doc,
  selection,
  fileName,
}: {
  doc: Y.Doc
  selection: string[]
  fileName: string
}) {
  const [sibuk, setSibuk] = useState(false)
  const frameId = selection.length === 1 ? selection[0] : null

  async function jalankan(format: 'svg' | 'png') {
    if (!frameId) return
    const kotak = boundsOf(doc, frameId)
    if (!kotak) return

    setSibuk(true)
    try {
      const nodes = subtree(readAllNodes(doc), frameId)
      const aset = await siapkanAsetDataUrl(nodes, createBrowserSupabase())
      const svg = frameKeSvg(nodes, kotak, aset)

      if (format === 'svg') {
        unduh(new Blob([svg], { type: 'image/svg+xml' }), `${fileName}.svg`)
      } else {
        unduh(await svgKePng(svg, kotak.w, kotak.h), `${fileName}.png`)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export gagal')
    } finally {
      setSibuk(false)
    }
  }

  const gaya = {
    color: frameId && !sibuk ? 'var(--text-1)' : 'var(--text-2)',
    fontSize: 12,
  } as const

  return (
    <div className="flex items-center gap-1">
      <button disabled={!frameId || sibuk} onClick={() => jalankan('svg')} style={gaya}>
        SVG
      </button>
      <button disabled={!frameId || sibuk} onClick={() => jalankan('png')} style={gaya}>
        PNG
      </button>
    </div>
  )
}
