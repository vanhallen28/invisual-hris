'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { createEmptyDoc } from '@/kanvas/doc/doc'
import { createNode, deleteNode, readAllNodes, readNode, updateNode } from '@/kanvas/doc/nodes'
import { groupNodes, ungroup } from '@/kanvas/doc/hierarchy'
import { createUndoManager } from '@/kanvas/doc/undo'
import { createDocStore } from '@/kanvas/bind/store'
import { useProvider } from '@/kanvas/bind/useProvider'
import { Scene } from '@/kanvas/render/Scene'
import { SelectionOverlay } from '@/kanvas/render/SelectionOverlay'
import { Marquee } from '@/kanvas/render/Marquee'
import { Cursors } from '@/kanvas/render/Cursors'
import { LayersPanel } from '@/kanvas/ui/LayersPanel'
import { PagesPanel } from '@/kanvas/ui/PagesPanel'
import { ensureFirstPage, listPages, type Page } from '@/kanvas/doc/pages'
import { PropertiesPanel } from '@/kanvas/ui/PropertiesPanel'
import { Toolbar, type Aksi } from '@/kanvas/ui/Toolbar'
import { PresenceBar } from '@/kanvas/ui/PresenceBar'
import { ExportMenu } from '@/kanvas/ui/ExportMenu'
import { useGesture } from '@/kanvas/interact/useGesture'
import { topmostAt } from '@/kanvas/interact/hitTest'
import type { Handle } from '@/kanvas/interact/transform'
import { unggahAset, ukuranGambar } from '@/kanvas/features/assets/upload'
import { dariBytea } from '@/kanvas/sync/hex'
import { TOOL_KEYS, toolToNodeType, type Tool } from '@/kanvas/state/tool'
import {
  IDENTITY_VIEWPORT,
  panBy,
  screenToWorld,
  worldRectKeLayar,
  zoomAt,
  type Viewport,
} from '@/kanvas/state/viewport'

export function EditorClient({
  fileId,
  fileName,
  projectId,
  snapshot,
  saya,
}: {
  fileId: string
  fileName: string
  projectId: string
  snapshot: string | null
  saya: { id: string; nama: string }
}) {
  const doc = useMemo(() => {
    const d = createEmptyDoc()
    if (snapshot) {
      // Origin 'remote' supaya pemuatan awal tidak masuk tumpukan
      // undo — Ctrl+Z tepat setelah membuka file tidak boleh
      // mengosongkan seluruh dokumen.
      Y.applyUpdate(d, dariBytea(snapshot), 'remote')
    }
    return d
  }, [snapshot])
  const store = useMemo(() => createDocStore(doc), [doc])
  const undo = useMemo(() => createUndoManager(doc), [doc])
  useEffect(() => {
    store.pasangUlang()          // StrictMode memasang efek dua kali
    return () => store.destroy()
  }, [store])

  // ── Halaman ──────────────────────────────────────────────
  // Dokumen selalu punya minimal satu halaman. Node lama yang belum
  // punya penanda halaman dianggap milik halaman pertama.
  const [pages, setPages] = useState<Page[]>([])
  const [pageAktif, setPageAktif] = useState('')
  const segarkanPages = useCallback(() => {
    const daftar = listPages(doc)
    setPages(daftar)
    return daftar
  }, [doc])

  useEffect(() => {
    const pertama = ensureFirstPage(doc)
    const daftar = listPages(doc)
    setPages(daftar)
    setPageAktif((p) => (p && daftar.some((x) => x.id === p) ? p : pertama))
  }, [doc])

  const pageAwal = pages[0]?.id || ''

  // Berpindah halaman harus melepas seleksi. Kalau tidak, penanda seleksi
  // tetap tergambar untuk node halaman lama padahal nodenya sudah tidak
  // dirender — itulah kotak biru yang melayang tanpa isi.
  useEffect(() => { setSelection([]) }, [pageAktif])

  const { status, peers, hadir, kirimKursor } = useProvider({ doc, fileId, saya })

  const [viewport, setViewport] = useState<Viewport>(IDENTITY_VIEWPORT)
  const [selection, setSelection] = useState<string[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const pan = useRef<{ x: number; y: number } | null>(null)
  const tarik = useRef<{ x: number; y: number } | null>(null)
  const [spasi, setSpasi] = useState(false)

  const { preview, mulai, lanjut, selesai } = useGesture({ doc, viewport })

  const layar = (e: React.PointerEvent) => {
    const kotak = (e.currentTarget as Element).getBoundingClientRect()
    return { x: e.clientX - kotak.left, y: e.clientY - kotak.top }
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const s = layar(e)
    e.currentTarget.setPointerCapture(e.pointerId)

    if (e.button === 1 || spasi || tool === 'hand') {
      pan.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (e.button !== 0) return

    const dunia = screenToWorld(viewport, s.x, s.y)
    const tipe = toolToNodeType(tool)

    if (tipe) {
      // Tool bentuk: buat objek 1×1 lalu langsung masuk mode resize
      // dari handle se, sehingga menyeret langsung menentukan ukuran.
      const id = createNode(doc, {
        type: tipe,
        page: pageAktif,
        x: dunia.x, y: dunia.y, w: 1, h: 1,
        ...(tipe === 'text' ? { text: 'Teks' } : {}),
        // Panah dipakai untuk menandai revisi, jadi harus langsung
        // terbaca. Garis setipis 1px terlalu samar di atas gambar.
        ...(tipe === 'arrow' ? { strokeWidth: 2, stroke: '#ef4444' } : {}),
      })
      setSelection([id])
      setTool('select')
      mulai({ jenis: 'resize', id, handle: 'se' })
      return
    }

    const kena = topmostAt(readAllNodes(doc), dunia.x, dunia.y)

    if (!kena) {
      setSelection([])
      tarik.current = dunia
      return
    }

    const barisan = e.shiftKey
      ? selection.includes(kena.id)
        ? selection.filter((id) => id !== kena.id)
        : [...selection, kena.id]
      : selection.includes(kena.id)
        ? selection
        : [kena.id]

    setSelection(barisan)
    mulai({ jenis: 'geser', ids: barisan, awalDunia: dunia })
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pan.current) {
      const dx = e.clientX - pan.current.x
      const dy = e.clientY - pan.current.y
      pan.current = { x: e.clientX, y: e.clientY }
      setViewport((vp) => panBy(vp, dx, dy))
      return
    }

    const s = layar(e)
    const d = screenToWorld(viewport, s.x, s.y)

    // Throttle dan penyaringan "hanya saat bergerak" ada di dalam
    // attachCursors, jadi aman dipanggil di setiap event.
    kirimKursor.current(d.x, d.y)

    if (tarik.current) {
      const a = tarik.current
      setMarquee({
        x: Math.min(a.x, d.x), y: Math.min(a.y, d.y),
        w: Math.abs(d.x - a.x), h: Math.abs(d.y - a.y),
      })
      return
    }

    lanjut(s.x, s.y, e.shiftKey)
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    pan.current = null

    if (tarik.current && marquee) {
      const m = marquee
      setSelection(
        readAllNodes(doc)
          .filter(
            (n) =>
              !n.locked && n.visible && n.type !== 'group' &&
              n.x < m.x + m.w && n.x + n.w > m.x &&
              n.y < m.y + m.h && n.y + n.h > m.y
          )
          .map((n) => n.id)
      )
    }
    tarik.current = null
    setMarquee(null)
    selesai()
  }

  const onHandleDown = useCallback(
    (e: React.PointerEvent, id: string, handle: Handle) => {
      e.stopPropagation()
      svgRef.current?.setPointerCapture(e.pointerId)
      mulai({ jenis: 'resize', id, handle })
    },
    [mulai]
  )

  const onRotateDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation()
      svgRef.current?.setPointerCapture(e.pointerId)
      mulai({ jenis: 'rotasi', id })
    },
    [mulai]
  )

  // Menaruh gambar lewat menu alat. Berkasnya diletakkan di tengah
  // layar, bukan di titik kursor, karena aksi ini datang dari menu.
  const berkasRef = useRef<HTMLInputElement>(null)

  async function taruhGambar(daftar: FileList | null) {
    if (!daftar?.length) return
    const dunia = screenToWorld(viewport, window.innerWidth / 2, window.innerHeight / 2)
    for (const f of Array.from(daftar)) {
      if (!f.type.startsWith('image/')) continue
      try {
        const assetId = await unggahAset(f, projectId)
        const gambar = await ukuranGambar(f)
        createNode(doc, {
          type: 'image', page: pageAktif, assetId,
          x: dunia.x, y: dunia.y, w: gambar.w, h: gambar.h,
        })
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Gagal mengunggah')
      }
    }
  }

  const jalankanAksi = (a: Aksi) => {
    if (a === 'gambar') berkasRef.current?.click()
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const berkas = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
    if (berkas.length === 0) return

    const kotak = e.currentTarget.getBoundingClientRect()
    const dunia = screenToWorld(viewport, e.clientX - kotak.left, e.clientY - kotak.top)

    for (const f of berkas) {
      try {
        const assetId = await unggahAset(f, projectId)
        const gambar = await ukuranGambar(f)
        createNode(doc, {
          type: 'image',
          page: pageAktif,
          assetId,
          x: dunia.x,
          y: dunia.y,
          w: gambar.w,
          h: gambar.h,
        })
      } catch (err) {
        // Node tidak dibuat kalau unggah gagal, supaya tidak ada
        // kotak kosong permanen di kanvas.
        alert(err instanceof Error ? err.message : 'Gagal mengunggah')
      }
    }
  }

  // React memasang onWheel sebagai listener pasif, sehingga
  // preventDefault di sana diabaikan dan Ctrl+wheel men-zoom
  // seluruh halaman.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const roda = (e: WheelEvent) => {
      e.preventDefault()
      const kotak = el.getBoundingClientRect()
      const sx = e.clientX - kotak.left
      const sy = e.clientY - kotak.top
      if (e.ctrlKey || e.metaKey) {
        setViewport((vp) => zoomAt(vp, sx, sy, Math.exp(-e.deltaY * 0.01)))
      } else {
        setViewport((vp) => panBy(vp, -e.deltaX, -e.deltaY))
      }
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [])

  useEffect(() => {
    const turun = (e: KeyboardEvent) => {
      // Jangan bajak papan ketik saat pengguna sedang mengetik
      // di panel properti atau mengganti nama layer.
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return

      const cmd = e.metaKey || e.ctrlKey

      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setSpasi(true); return }

      if (cmd && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) undo.redo()
        else undo.undo()
        return
      }
      if (cmd && e.code === 'KeyY') { e.preventDefault(); undo.redo(); return }

      if (cmd && e.code === 'KeyG') {
        e.preventDefault()
        if (e.shiftKey) {
          for (const id of selection) {
            if (readNode(doc, id)?.type === 'group') ungroup(doc, id)
          }
        } else {
          const g = groupNodes(doc, selection)
          if (g) setSelection([g])
        }
        return
      }

      if (cmd && e.code === 'KeyD') {
        e.preventDefault()
        const baru = selection.flatMap((id) => {
          const n = readNode(doc, id)
          if (!n) return []
          const { id: _buang, order: _urut, ...sisa } = n
          void _buang
          void _urut
          return [createNode(doc, { ...sisa, page: n.page || pageAktif, x: n.x + 10, y: n.y + 10 })]
        })
        if (baru.length) setSelection(baru)
        return
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault()
        for (const id of selection) deleteNode(doc, id)
        setSelection([])
        return
      }

      const nudge = e.shiftKey ? 10 : 1
      const arah: Record<string, [number, number]> = {
        ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0],
        ArrowUp: [0, -nudge], ArrowDown: [0, nudge],
      }
      if (arah[e.code]) {
        e.preventDefault()
        const [dx, dy] = arah[e.code]
        doc.transact(() => {
          for (const id of selection) {
            const n = readNode(doc, id)
            if (n) updateNode(doc, id, { x: n.x + dx, y: n.y + dy })
          }
        }, 'local')
        return
      }

      if (!cmd && TOOL_KEYS[e.code]) setTool(TOOL_KEYS[e.code])
    }

    const naik = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpasi(false)
    }

    window.addEventListener('keydown', turun)
    window.addEventListener('keyup', naik)
    return () => {
      window.removeEventListener('keydown', turun)
      window.removeEventListener('keyup', naik)
    }
  }, [doc, selection, undo])

  const pilihDariPanel = useCallback(
    (id: string, shift: boolean) => {
      setSelection((lama) =>
        shift
          ? lama.includes(id) ? lama.filter((x) => x !== id) : [...lama, id]
          : [id]
      )
    },
    []
  )

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--surface-0)' }}>
      <input
        ref={berkasRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => { taruhGambar(e.target.files); e.currentTarget.value = '' }}
      />
      <header
        className="flex items-center gap-4 px-3 py-1.5"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {/* Nama berkas tidak ditulis di sini. Pembungkus Test Project
            sudah menampilkannya di baris atas, dan dua nama yang sama
            bertumpuk hanya menambah keramaian. */}
        <ExportMenu doc={doc} selection={selection} fileName={fileName} />
        <div className="ml-auto flex items-center gap-3">
          <PresenceBar hadir={hadir} kecuali={saya.id} />
          <span className="num" style={{ color: 'var(--text-1)' }}>
            {Math.round(viewport.zoom * 100)}%
          </span>
        </div>
      </header>

      {status !== 'tersambung' && (
        <div
          className="num px-3 py-1"
          style={{
            background: status === 'terputus' ? '#3a2a10' : 'var(--surface-2)',
            color: status === 'terputus' ? '#f0a020' : 'var(--text-1)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {status === 'terputus'
            ? 'Offline — perubahan tersimpan lokal dan akan menyatu saat tersambung lagi'
            : 'Menyambung…'}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar kiri — halaman di atas, layer di bawah. */}
        <div
          className="flex flex-col"
          style={{ width: 200, borderRight: '1px solid var(--line)', background: 'var(--surface-1)' }}
        >
          <PagesPanel
            doc={doc}
            pages={pages}
            aktif={pageAktif}
            onPilih={setPageAktif}
            onBerubah={segarkanPages}
          />
          <LayersPanel
            doc={doc}
            store={store}
            selection={selection}
            onSelect={pilihDariPanel}
            page={pageAktif}
            pageAwal={pageAwal}
          />
        </div>

        <div
          className="flex-1"
          style={{ cursor: spasi ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Scene
            svgRef={svgRef}
            store={store}
            viewport={viewport}
            preview={preview}
            page={pageAktif}
            pageAwal={pageAwal}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            overlay={
              <>
                <SelectionOverlay
                  store={store}
                  selection={selection}
                  viewport={viewport}
                  preview={preview}
                  onHandleDown={onHandleDown}
                  onRotateDown={onRotateDown}
                />
                <Cursors peers={peers} viewport={viewport} />
                <Marquee rect={marquee ? worldRectKeLayar(marquee, viewport) : null} />
              </>
            }
          />
        </div>

        {/* Alat gambar — pindah dari header ke sisi kanan sebagai ikon. */}
        <div
          className="flex flex-col items-center"
          style={{ padding: '8px 6px', borderLeft: '1px solid var(--line)', background: 'var(--surface-1)' }}
        >
          <Toolbar tool={tool} onTool={setTool} onAksi={jalankanAksi} />
        </div>

        <PropertiesPanel doc={doc} store={store} selection={selection} />
      </div>
    </div>
  )
}
