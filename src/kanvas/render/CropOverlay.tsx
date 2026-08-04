'use client'

import { useEffect, useRef, useState } from 'react'
import { useNode } from '@/kanvas/bind/hooks'
import type { DocStore } from '@/kanvas/bind/store'
import type { SceneNode } from '@/kanvas/doc/types'
import { updateNode } from '@/kanvas/doc/nodes'
import { createBrowserSupabase } from '@/kanvas/lib/supabase'
import { worldToScreen, screenToWorld, type Viewport } from '@/kanvas/state/viewport'
import type { Handle } from '@/kanvas/interact/transform'
import {
  cropCoverAwal,
  geserCrop,
  resizeJendela,
  putarVektor,
  type Crop,
} from '@/kanvas/interact/crop'

const UKURAN_HANDLE = 8
const BESAR = 100000 // agar tirai gelap menutup seluruh layar meski node berotasi

const KURSOR: Record<Handle, string> = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
  se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
}

type Drag =
  | { mode: 'pan'; node0: SceneNode; crop0: Crop; awal: { x: number; y: number } }
  | { mode: 'resize'; handle: Handle; node0: SceneNode; crop0: Crop }

/**
 * Lapisan mode potong (crop) ala Figma. Digambar di ruang LAYAR (seperti
 * SelectionOverlay) supaya gagang berukuran tetap berapa pun zoom-nya.
 *
 * Seluruh interaksi (geser gambar, ubah bentuk jendela) MANDIRI di sini —
 * lewat penangkapan pointer sendiri, tidak melalui sistem gestur biasa —
 * sehingga tidak ada risiko regresi pada drag/resize/rotasi yang sudah jalan.
 */
export function CropOverlay({
  store,
  doc,
  id,
  viewport,
  onSelesai,
}: {
  store: DocStore
  doc: Parameters<typeof updateNode>[0]
  id: string
  viewport: Viewport
  onSelesai: () => void
}) {
  const node = useNode(store, id)
  const [url, setUrl] = useState<string | null>(null)
  const [rasioAsli, setRasioAsli] = useState<number | null>(null)
  const sudahInit = useRef(false)
  const drag = useRef<Drag | null>(null)

  // Ambil URL bertanda tangan lalu baca ukuran ALAMI gambar (untuk rasio),
  // agar cover-fit awal tidak mendistorsi. Berlaku untuk gambar lama & baru.
  useEffect(() => {
    const assetId = node?.assetId
    if (!assetId) return
    let batal = false
    createBrowserSupabase()
      .storage.from('assets')
      .createSignedUrl(assetId, 24 * 3600)
      .then(({ data }) => {
        if (batal || !data?.signedUrl) return
        setUrl(data.signedUrl)
        const img = new Image()
        img.onload = () => {
          if (!batal) setRasioAsli(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1)
        }
        img.onerror = () => { if (!batal) setRasioAsli(1) }
        img.src = data.signedUrl
      })
    return () => { batal = true }
  }, [node?.assetId])

  // Saat masuk mode dan node BELUM punya crop, isi cover-fit sekali.
  useEffect(() => {
    if (sudahInit.current || !node || node.crop || rasioAsli == null) return
    sudahInit.current = true
    updateNode(doc, id, { crop: cropCoverAwal({ w: node.w, h: node.h }, rasioAsli) })
  }, [doc, id, node, rasioAsli])

  const ptDunia = (e: React.PointerEvent): { x: number; y: number } => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement
    const kotak = svg?.getBoundingClientRect()
    const sx = e.clientX - (kotak?.left ?? 0)
    const sy = e.clientY - (kotak?.top ?? 0)
    return screenToWorld(viewport, sx, sy)
  }

  const mulaiPan = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (!node?.crop) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { mode: 'pan', node0: node, crop0: node.crop, awal: ptDunia(e) }
  }

  const mulaiResize = (handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (!node?.crop) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { mode: 'resize', handle, node0: node, crop0: node.crop }
  }

  const gerak = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = ptDunia(e)
    if (d.mode === 'pan') {
      // Delta layar→dunia lalu diputar-balik ke ruang lokal node (untuk node
      // berotasi), kemudian dijadikan pecahan kotak.
      const lok = putarVektor(p.x - d.awal.x, p.y - d.awal.y, -d.node0.rotation)
      const crop = geserCrop(d.crop0, lok.x / d.node0.w, lok.y / d.node0.h)
      updateNode(doc, id, { crop })
    } else {
      const { kotak, crop } = resizeJendela(d.node0, d.crop0, d.handle, p.x, p.y)
      updateNode(doc, id, { x: kotak.x, y: kotak.y, w: kotak.w, h: kotak.h, crop })
    }
  }

  const lepas = (e: React.PointerEvent) => {
    if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    }
    drag.current = null
  }

  if (!node) return null

  // Selama URL/crop belum siap, tetap tangkap klik agar kanvas tak bereaksi.
  if (!url || !node.crop) {
    return (
      <rect
        x={0} y={0} width="100%" height="100%"
        fill="transparent" pointerEvents="all"
        onPointerDown={(e) => { e.stopPropagation(); onSelesai() }}
      />
    )
  }

  const c = node.crop
  const zoom = viewport.zoom
  const jendela = worldToScreen(viewport, node.x, node.y)
  const jw = node.w * zoom
  const jh = node.h * zoom
  const cx = jendela.x + jw / 2
  const cy = jendela.y + jh / 2

  const rTl = worldToScreen(viewport, node.x + c.ix * node.w, node.y + c.iy * node.h)
  const rw = c.iw * node.w * zoom
  const rh = c.ih * node.h * zoom

  const rot = node.rotation ? `rotate(${node.rotation} ${cx} ${cy})` : undefined

  // Delapan gagang di tepi jendela (sama gaya SelectionOverlay).
  const gagang: Array<[Handle, number, number]> = [
    ['nw', jendela.x, jendela.y],
    ['n', cx, jendela.y],
    ['ne', jendela.x + jw, jendela.y],
    ['e', jendela.x + jw, cy],
    ['se', jendela.x + jw, jendela.y + jh],
    ['s', cx, jendela.y + jh],
    ['sw', jendela.x, jendela.y + jh],
    ['w', jendela.x, cy],
  ]

  const gelap = 'rgba(10,10,10,0.55)'

  return (
    <g transform={rot}>
      {/* Gambar penuh (terang) sebagai latar. */}
      <image
        href={url}
        x={rTl.x} y={rTl.y} width={rw} height={rh}
        preserveAspectRatio="none" pointerEvents="none"
      />

      {/* Tirai gelap MENGELILINGI jendela (empat bilah), menyisakan jendela
          terang. Mengklik area gelap = selesai memotong (perilaku Figma). */}
      <g onPointerDown={(e) => { e.stopPropagation(); onSelesai() }}>
        <rect x={-BESAR} y={-BESAR} width={2 * BESAR} height={jendela.y + BESAR} fill={gelap} />
        <rect x={-BESAR} y={jendela.y + jh} width={2 * BESAR} height={BESAR} fill={gelap} />
        <rect x={-BESAR} y={jendela.y} width={jendela.x + BESAR} height={jh} fill={gelap} />
        <rect x={jendela.x + jw} y={jendela.y} width={BESAR} height={jh} fill={gelap} />
      </g>

      {/* Area jendela: seret di sini = geser gambar (pan). */}
      <rect
        x={jendela.x} y={jendela.y} width={jw} height={jh}
        fill="transparent" pointerEvents="all" style={{ cursor: 'move' }}
        onPointerDown={mulaiPan} onPointerMove={gerak} onPointerUp={lepas}
      />

      {/* Garis bantu pertiga. */}
      <g pointerEvents="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.75}>
        <line x1={jendela.x + jw / 3} y1={jendela.y} x2={jendela.x + jw / 3} y2={jendela.y + jh} />
        <line x1={jendela.x + (2 * jw) / 3} y1={jendela.y} x2={jendela.x + (2 * jw) / 3} y2={jendela.y + jh} />
        <line x1={jendela.x} y1={jendela.y + jh / 3} x2={jendela.x + jw} y2={jendela.y + jh / 3} />
        <line x1={jendela.x} y1={jendela.y + (2 * jh) / 3} x2={jendela.x + jw} y2={jendela.y + (2 * jh) / 3} />
      </g>

      {/* Bingkai jendela. */}
      <rect
        x={jendela.x} y={jendela.y} width={jw} height={jh}
        fill="none" stroke="var(--accent)" strokeWidth={1.5} pointerEvents="none"
      />

      {/* Gagang ubah bentuk jendela. */}
      {gagang.map(([h, hx, hy]) => (
        <rect
          key={h}
          x={hx - UKURAN_HANDLE / 2} y={hy - UKURAN_HANDLE / 2}
          width={UKURAN_HANDLE} height={UKURAN_HANDLE}
          fill="var(--surface-0)" stroke="var(--accent)" strokeWidth={1.5}
          style={{ cursor: KURSOR[h] }} pointerEvents="all"
          onPointerDown={mulaiResize(h)} onPointerMove={gerak} onPointerUp={lepas}
        />
      ))}
    </g>
  )
}
