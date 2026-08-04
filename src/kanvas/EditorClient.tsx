'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { createEmptyDoc } from '@/kanvas/doc/doc'
import { createNode, deleteNode, hapusFieldNode, readAllNodes, readNode, updateNode } from '@/kanvas/doc/nodes'
import { groupNodes, ungroup } from '@/kanvas/doc/hierarchy'
import { createUndoManager } from '@/kanvas/doc/undo'
import { createDocStore } from '@/kanvas/bind/store'
import { useProvider } from '@/kanvas/bind/useProvider'
import { Scene } from '@/kanvas/render/Scene'
import { SelectionOverlay } from '@/kanvas/render/SelectionOverlay'
import { CropOverlay } from '@/kanvas/render/CropOverlay'
import { PathEditOverlay } from '@/kanvas/render/PathEditOverlay'
import { ContentCropOverlay } from '@/kanvas/render/ContentCropOverlay'
import { useNodeIds } from '@/kanvas/bind/hooks'
import { ukurLebar, bungkusBaris } from '@/kanvas/render/ukurTeks'

/**
 * Menjaga ukuran kotak teks sesuai mode: 'auto-w' memeluk teks (atur W&H),
 * 'auto-h' menjaga lebar & menyesuaikan tinggi, 'fixed' dibiarkan. Pengukuran
 * pakai Canvas 2D; hanya memperbarui bila selisih berarti (>0.6px) supaya tak
 * berputar tanpa henti.
 */
function PengukurTeks({ doc, store, page, pageAwal }: { doc: any; store: any; page?: string; pageAwal?: string }) {
  const ids = useNodeIds(store)
  useEffect(() => {
    const ukur = () => {
      for (const id of ids) {
        const n = store.getNode(id)
        if (!n || n.type !== 'text') continue
        if (page && (n.page || pageAwal) !== page) continue
        const mode = n.resize || 'auto-w'
        if (mode === 'fixed') continue
        const fs = n.fontSize && n.fontSize > 0 ? n.fontSize : 16
        const lh = n.lineHeight && n.lineHeight > 0 ? n.lineHeight : 1.2
        const font = `${n.fontWeight || 400} ${fs}px ${n.fontFamily || 'var(--font-ui), sans-serif'}`
        if (mode === 'auto-w') {
          const baris = String(n.text ?? '').split('\n')
          const w = baris.reduce((m: number, l: string) => Math.max(m, ukurLebar(l || ' ', font)), 1) + 2
          const h = Math.max(1, baris.length * fs * lh)
          const patch: Record<string, number> = {}
          if (Math.abs(w - n.w) > 0.6) patch.w = Math.round(w)
          if (Math.abs(h - n.h) > 0.6) patch.h = Math.round(h)
          if (Object.keys(patch).length) updateNode(doc, id, patch)
        } else {
          const baris = bungkusBaris(String(n.text ?? ''), n.w, font)
          const h = Math.max(1, baris.length * fs * lh)
          if (Math.abs(h - n.h) > 0.6) updateNode(doc, id, { h: Math.round(h) })
        }
      }
    }
    ukur()
    doc.on('update', ukur)
    return () => { doc.off('update', ukur) }
  }, [doc, store, ids, page, pageAwal])
  return null
}
import { Marquee } from '@/kanvas/render/Marquee'
import { FrameLabels } from '@/kanvas/render/FrameLabels'
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
import { ACCEPT_IMPOR, PESAN_FIG, pesanTakDidukung, pilahBerkas } from '@/kanvas/lib/impor'
import { dariBytea } from '@/kanvas/sync/hex'
import { TOOL_KEYS, toolToNodeType, type Tool } from '@/kanvas/state/tool'
import { skalaCrop, snapRasio, skalaIsi } from '@/kanvas/interact/crop'
import {
  IDENTITY_VIEWPORT,
  panBy,
  screenToWorld,
  worldRectKeLayar,
  worldToScreen,
  zoomAt,
  type Viewport,
} from '@/kanvas/state/viewport'
import { dJalurPen } from '@/kanvas/render/penPath'
import { normalisasiPen, hapusAnchor, bboxPen } from '@/kanvas/interact/pen'
import type { PenPoint } from '@/kanvas/doc/types'
import { useKomentar, buatKomentar } from '@/kanvas/doc/comments'
import { CommentPins } from '@/kanvas/render/CommentPins'
import { CommentPopover } from '@/kanvas/ui/CommentPopover'

export function EditorClient({
  fileId,
  fileName,
  projectId,
  snapshot,
  saya,
  berkasAwal,
  onBerkasAwalSelesai,
}: {
  fileId: string
  fileName: string
  projectId: string
  snapshot: string | null
  /** Berkas titipan dari tombol Impor di daftar kanvas. Ditaruh sekali. */
  berkasAwal?: File[] | null
  onBerkasAwalSelesai?: () => void
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
  /* Coretan tangan yang sedang digambar. Titik dikumpulkan di ref, bukan
     state: satu gerakan menghasilkan ratusan titik, dan setState di tiap
     titik akan menggambar ulang seluruh kanvas ratusan kali. State hanya
     dipakai untuk pratinjau garisnya. */
  const coretRef = useRef<number[] | null>(null)
  const [coretPratinjau, setCoretPratinjau] = useState<number[] | null>(null)

  /* Warna catatan yang terakhir dipakai. Saat membuat banyak catatan
     beruntun, memilih ulang warna tiap kali memutus alurnya.

     Diperbarui setiap kali sebuah catatan terpilih — jadi mengganti warna
     lewat pemilih warna di panel kanan otomatis jadi warna bawaan
     berikutnya, tanpa perlu pengaturan terpisah. */
  const warnaCatatanRef = useRef('#fde68a')
  /** Warna coretan terakhir — sama alasannya dengan warna catatan. */
  const warnaCoretRef = useRef('#ef4444')
  useEffect(() => {
    if (selection.length !== 1) return
    const n = readNode(doc, selection[0])
    if (n?.type === 'sticky' && typeof n.fill === 'string') warnaCatatanRef.current = n.fill
    if (n?.type === 'draw' && typeof n.stroke === 'string') warnaCoretRef.current = n.stroke
  }, [selection, doc])
  const pan = useRef<{ x: number; y: number } | null>(null)
  const tarik = useRef<{ x: number; y: number } | null>(null)
  const [spasi, setSpasi] = useState(false)

  /* Mode potong (crop). `cropId` = node gambar yang sedang dipotong, atau null.
     Ref-nya dipakai di penangan roda-mouse (efek ber-deps [] akan melihat
     state basi lewat closure). `cropAsliRef` menyimpan crop SEBELUM masuk,
     supaya Escape bisa membatalkan (kembalikan seperti semula). */
  const [cropId, setCropId] = useState<string | null>(null)
  const cropIdRef = useRef<string | null>(null)
  const cropAsliRef = useRef<{ ix: number; iy: number; iw: number; ih: number } | undefined>(undefined)
  useEffect(() => { cropIdRef.current = cropId }, [cropId])

  const masukCrop = useCallback((id: string) => {
    const n = readNode(doc, id)
    if (!n || n.type !== 'image') return
    cropAsliRef.current = n.crop
    setSelection([id])
    setCropId(id)
  }, [doc])

  const keluarCrop = useCallback((simpan: boolean) => {
    const id = cropIdRef.current
    if (id && !simpan) {
      // Batal: kembalikan crop seperti sebelum masuk. Kalau dulu tak ada crop,
      // hapus fieldnya supaya gambar kembali penuh.
      if (cropAsliRef.current) updateNode(doc, id, { crop: cropAsliRef.current })
      else hapusFieldNode(doc, id, 'crop')
    }
    cropAsliRef.current = undefined
    setCropId(null)
  }, [doc])

  /* Potong ISI untuk node NON-GAMBAR (geser/skala isi di dalam jendela).
     Terpisah dari crop gambar (`cropId`) karena tak ada syarat menutup dan
     skalanya seragam. */
  const [cropIsiId, setCropIsiId] = useState<string | null>(null)
  const cropIsiIdRef = useRef<string | null>(null)
  const cropIsiAsliRef = useRef<{ ix: number; iy: number; iw: number; ih: number } | undefined>(undefined)
  useEffect(() => { cropIsiIdRef.current = cropIsiId }, [cropIsiId])

  const masukCropIsi = useCallback((id: string) => {
    const n = readNode(doc, id)
    if (!n || n.type === 'image') return // gambar memakai crop-nya sendiri
    cropIsiAsliRef.current = n.crop
    if (!n.crop) updateNode(doc, id, { crop: { ix: 0, iy: 0, iw: 1, ih: 1 } })
    setSelection([id])
    setCropIsiId(id)
  }, [doc])

  const keluarCropIsi = useCallback((simpan: boolean) => {
    const id = cropIsiIdRef.current
    if (id && !simpan) {
      if (cropIsiAsliRef.current) updateNode(doc, id, { crop: cropIsiAsliRef.current })
      else hapusFieldNode(doc, id, 'crop')
    }
    cropIsiAsliRef.current = undefined
    setCropIsiId(null)
  }, [doc])

  /* Jalur Pen yang sedang digambar (belum jadi node). `penPts` = anchor yang
     sudah ditaruh; `penCursor` = posisi kursor untuk pratinjau ruas berikutnya.
     Ref dipakai di penangan pointer & keyboard yang membaca lewat closure. */
  const [penPts, setPenPts] = useState<PenPoint[] | null>(null)
  const penPtsRef = useRef<PenPoint[] | null>(null)
  const [penCursor, setPenCursor] = useState<{ x: number; y: number } | null>(null)
  const penAturRef = useRef(false)                                   // sedang menyeret handle titik terakhir
  const penAnchorRef = useRef<{ x: number; y: number } | null>(null) // posisi anchor titik terakhir
  useEffect(() => { penPtsRef.current = penPts }, [penPts])

  const buangPen = useCallback(() => {
    setPenPts(null); penPtsRef.current = null; setPenCursor(null)
    penAturRef.current = false; penAnchorRef.current = null
  }, [])

  /* Id objek "Teks di jalur" yang BARU dibuat — sinyal agar panel memfokuskan
     kolom teksnya sekali, supaya bisa langsung diketik setelah menggambar. */
  const [idTeksBaru, setIdTeksBaru] = useState<string | null>(null)

  /* Komentar (pin). Disimpan di map Yjs terpisah; `openKomentar` = pin yang
     popovernya sedang terbuka. */
  const komentar = useKomentar(doc)
  const [openKomentar, setOpenKomentar] = useState<string | null>(null)

  // Berganti alat saat menggambar jalur = batalkan jalur yang belum selesai,
  // supaya tidak ada sisa yang muncul lagi saat Pen dipilih berikutnya.
  useEffect(() => {
    if (tool !== 'pen' && tool !== 'textpath' && penPtsRef.current) buangPen()
  }, [tool, buangPen])

  const finalisasiPen = useCallback((pts: PenPoint[] | null, closed: boolean) => {
    const isi = pts ?? []
    if (isi.length < 2) { buangPen(); return }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const catat = (x: number, y: number) => {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    for (const p of isi) {
      catat(p.x, p.y)
      if (p.hix != null && p.hiy != null) catat(p.hix, p.hiy)
      if (p.hox != null && p.hoy != null) catat(p.hox, p.hoy)
    }

    const teksJalur = tool === 'textpath'
    const id = createNode(doc, {
      type: teksJalur ? 'textpath' : 'pen',
      page: pageAktif,
      x: minX, y: minY,
      w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY),
      path: { pts: isi, closed },
      ...(teksJalur
        ? { text: 'Teks', fill: '#e5e5e5', stroke: 'transparent', strokeWidth: 1, fontSize: 24 }
        : { fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 }),
    })
    buangPen()
    setSelection([id])
    setTool('select')
    if (teksJalur) setIdTeksBaru(id)
  }, [doc, pageAktif, buangPen, tool])

  /* Mode sunting jalur: node pen yang sedang disunting + anchor terpilih
     (untuk dihapus). Ref dipakai penangan pointer/keyboard lewat closure. */
  const [penEditId, setPenEditId] = useState<string | null>(null)
  const penEditIdRef = useRef<string | null>(null)
  const [penSel, setPenSel] = useState<number | null>(null)
  const penSelRef = useRef<number | null>(null)
  useEffect(() => { penEditIdRef.current = penEditId }, [penEditId])
  useEffect(() => { penSelRef.current = penSel }, [penSel])

  const masukSuntingPen = useCallback((id: string) => {
    const n = readNode(doc, id)
    if (!n || (n.type !== 'pen' && n.type !== 'textpath') || !n.path) return
    // Normalkan sekali: "bake" skala resize apa pun agar penyuntingan 1:1.
    const npts = normalisasiPen(n.path.pts, { x: n.x, y: n.y, w: n.w, h: n.h })
    updateNode(doc, id, { path: { pts: npts, closed: n.path.closed } })
    setSelection([id])
    setPenSel(null)
    setPenEditId(id)
  }, [doc])

  const keluarSuntingPen = useCallback(() => {
    setPenEditId(null)
    setPenSel(null)
  }, [])

  const hapusAnchorTerpilih = useCallback(() => {
    const id = penEditIdRef.current
    const i = penSelRef.current
    if (id == null || i == null) return
    const n = readNode(doc, id)
    if (!n || (n.type !== 'pen' && n.type !== 'textpath') || !n.path) return
    // Jalur butuh minimal 2 titik; kalau tinggal 2, hapus titik = hapus jalur.
    if (n.path.pts.length <= 2) {
      deleteNode(doc, id)
      keluarSuntingPen()
      setSelection([])
      return
    }
    const npts = hapusAnchor(n.path.pts, i)
    const bb = bboxPen(npts)
    updateNode(doc, id, { x: bb.x, y: bb.y, w: bb.w, h: bb.h, path: { pts: npts, closed: n.path.closed } })
    setPenSel(null)
  }, [doc, keluarSuntingPen])

  const { preview, mulai, lanjut, selesai } = useGesture({ doc, viewport })

  const layar = (e: React.PointerEvent) => {
    const kotak = (e.currentTarget as Element).getBoundingClientRect()
    return { x: e.clientX - kotak.left, y: e.clientY - kotak.top }
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Saat mode potong ATAU mode sunting jalur aktif, kanvas tidak menerima
    // interaksi — seluruhnya ditangani overlay masing-masing.
    if (cropIdRef.current || penEditIdRef.current || cropIsiIdRef.current) return
    // Klik pada kanvas menutup popover komentar yang terbuka (klik pada pin
    // sendiri sudah menghentikan propagasi, jadi tidak sampai ke sini).
    if (openKomentar && tool !== 'comment') setOpenKomentar(null)
    const s = layar(e)
    e.currentTarget.setPointerCapture(e.pointerId)

    if (e.button === 1 || spasi || tool === 'hand') {
      pan.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (e.button !== 0) return

    const dunia = screenToWorld(viewport, s.x, s.y)
    const tipe = toolToNodeType(tool)

    // Komentar: klik menaruh pin baru di titik itu lalu membuka popovernya.
    if (tool === 'comment') {
      const id = buatKomentar(doc, { x: dunia.x, y: dunia.y, page: pageAktif, text: '', oleh: saya.nama })
      setOpenKomentar(id)
      setTool('select')
      return
    }

    // Pen: setiap klik menaruh anchor. Klik titik pertama (bila sudah ≥2)
    // menutup jalur. Menyeret sebelum melepas menjadikan titik itu MULUS.
    // Berlaku sama untuk alat Teks-di-jalur (bedanya hanya tipe node saat jadi).
    if (tool === 'pen' || tool === 'textpath') {
      const arr = penPtsRef.current
      if (arr && arr.length >= 2) {
        const AMB = 8 / viewport.zoom
        const p0 = arr[0]
        if (Math.hypot(dunia.x - p0.x, dunia.y - p0.y) <= AMB) {
          finalisasiPen(arr, true)
          return
        }
      }
      const baru = [...(arr ?? []), { x: dunia.x, y: dunia.y }]
      setPenPts(baru); penPtsRef.current = baru
      penAturRef.current = true
      penAnchorRef.current = { x: dunia.x, y: dunia.y }
      return
    }

    // Coret tangan tidak membuat node saat ditekan — node baru dibuat
    // setelah gerakan selesai, supaya satu coretan jadi satu objek.
    if (tool === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId)
      coretRef.current = [dunia.x, dunia.y]
      setCoretPratinjau([dunia.x, dunia.y])
      return
    }

    if (tipe) {
      // Tool bentuk: buat objek 1×1 lalu langsung masuk mode resize
      // dari handle se, sehingga menyeret langsung menentukan ukuran.
      // Catatan tempel dibuat sekali klik dengan ukuran tetap — seperti
      // FigJam. Menyeret untuk menentukan ukuran justru memperlambat, dan
      // ukuran seragam membuat papan curah gagasan lebih mudah dibaca.
      const catatan = tipe === 'sticky'
      const sisi = 180

      const id = createNode(doc, {
        type: tipe,
        page: pageAktif,
        ...(catatan
          ? { x: dunia.x - sisi / 2, y: dunia.y - sisi / 2, w: sisi, h: sisi,
              fill: warnaCatatanRef.current, text: '', radius: 6 }
          : { x: dunia.x, y: dunia.y, w: 1, h: 1 }),
        ...(tipe === 'text' ? { text: 'Teks' } : {}),
        // Panah dipakai untuk menandai revisi, jadi harus langsung
        // terbaca. Garis setipis 1px terlalu samar di atas gambar.
        ...(tipe === 'arrow' ? { strokeWidth: 2, stroke: '#ef4444' } : {}),
      })
      setSelection([id])
      setTool('select')
      // Catatan sudah punya ukuran final, jadi tidak masuk mode resize.
      if (!catatan) mulai({ jenis: 'resize', id, handle: 'se' })
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

    // Pen: kursor menggerakkan pratinjau ruas berikutnya. Bila sedang menyeret
    // (setelah menaruh titik), seretannya menentukan handle titik terakhir —
    // dekat anchor = tetap SUDUT, jauh = MULUS dengan handle tercermin.
    if (tool === 'pen' || tool === 'textpath') {
      setPenCursor(d)
      if (penAturRef.current && penPtsRef.current && penAnchorRef.current) {
        const a = penAnchorRef.current
        const jauh = Math.hypot(d.x - a.x, d.y - a.y) > 4 / viewport.zoom
        const arr = penPtsRef.current
        const i = arr.length - 1
        const baru = arr.map((p, idx) => {
          if (idx !== i) return p
          if (!jauh) return { x: p.x, y: p.y }
          return { x: p.x, y: p.y, hox: d.x, hoy: d.y, hix: 2 * a.x - d.x, hiy: 2 * a.y - d.y }
        })
        setPenPts(baru); penPtsRef.current = baru
      }
      return
    }

    if (coretRef.current) {
      const t = coretRef.current
      // Titik yang terlalu rapat dibuang: mengurangi ukuran dokumen dan
      // membuat garisnya lebih halus, tanpa mengubah bentuk coretan.
      const dx = d.x - t[t.length - 2]
      const dy = d.y - t[t.length - 1]
      if (dx * dx + dy * dy >= 4) {
        t.push(d.x, d.y)
        setCoretPratinjau([...t])
      }
      return
    }

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

    // Pen: lepas jari = titik terakhir selesai (sudut atau mulus sesuai seret).
    // Jalur belum ditutup; klik berikutnya menaruh titik lagi.
    if (tool === 'pen' || tool === 'textpath') {
      penAturRef.current = false
      penAnchorRef.current = null
      return
    }

    if (coretRef.current) {
      const t = coretRef.current
      coretRef.current = null
      setCoretPratinjau(null)

      // Ketukan tunggal tanpa gerakan bukan coretan — jangan tinggalkan
      // objek tak kasatmata yang mengganggu seleksi.
      if (t.length >= 6) {
        let minX = Infinity, minY = Infinity, maksX = -Infinity, maksY = -Infinity
        for (let i = 0; i < t.length; i += 2) {
          minX = Math.min(minX, t[i]); maksX = Math.max(maksX, t[i])
          minY = Math.min(minY, t[i + 1]); maksY = Math.max(maksY, t[i + 1])
        }
        const id = createNode(doc, {
          type: 'draw', page: pageAktif,
          x: minX, y: minY,
          w: Math.max(1, maksX - minX), h: Math.max(1, maksY - minY),
          points: t,
          fill: 'transparent',
          stroke: warnaCoretRef.current,
          strokeWidth: 3,
        })
        setSelection([id])
      }
      setTool('select')
      return
    }

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

  // Dobel-klik sebuah gambar → masuk mode potong. Node lain diabaikan.
  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Saat menggambar Pen, dua klik dobel-klik menaruh dua titik di posisi
    // sama; buang satu lalu selesaikan jalur terbuka.
    if (penPtsRef.current) {
      e.preventDefault()
      finalisasiPen(penPtsRef.current.slice(0, -1), false)
      return
    }
    const kotak = e.currentTarget.getBoundingClientRect()
    const dunia = screenToWorld(viewport, e.clientX - kotak.left, e.clientY - kotak.top)
    const kena = topmostAt(readAllNodes(doc), dunia.x, dunia.y)
    // Masuk mode edit apa pun menutup popover komentar yang mungkin terbuka.
    if (openKomentar) setOpenKomentar(null)
    if (kena?.type === 'image') {
      e.preventDefault()
      masukCrop(kena.id)
    } else if (kena?.type === 'pen' || kena?.type === 'textpath') {
      e.preventDefault()
      masukSuntingPen(kena.id)
    } else if (kena && (kena.type === 'group' || kena.type === 'draw')) {
      // Hanya tipe yang jelas berguna: grup (komposisi) & coretan. Untuk
      // teks/catatan/bentuk/frame, potong isi tersedia lewat tombol panel
      // (agar dobel-klik tak mengejutkan). Jalur/gambar ditangani di atas.
      e.preventDefault()
      masukCropIsi(kena.id)
    }
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


  async function taruhGambar(daftar: FileList | File[] | null) {
    if (!daftar?.length) return
    const dunia = screenToWorld(viewport, window.innerWidth / 2, window.innerHeight / 2)

    // .fig dikenali dan dijelaskan, bukan diabaikan diam-diam — dulu
    // berkasnya hilang begitu saja tanpa pesan apa pun.
    const { dipakai, fig, ditolak } = pilahBerkas(Array.from(daftar))
    if (fig.length) alert(PESAN_FIG)
    if (ditolak.length) alert(pesanTakDidukung(ditolak[0]))

    await tempatkanBerkas(dipakai, dunia)
  }

  /* Menaruh sekumpulan berkas berjajar rapi.
     Dulu SEMUANYA ditaruh di titik yang sama, jadi mengimpor 20 berkas
     menghasilkan satu tumpukan yang harus dipisah satu per satu dengan
     tangan. Sekarang disusun jadi kisi: baris demi baris, dengan jarak
     tetap, dan tinggi baris mengikuti gambar tertinggi di baris itu. */
  async function tempatkanBerkas(berkas: File[], mulaiDi: { x: number; y: number }) {
    const JARAK = 24
    const PER_BARIS = Math.max(1, Math.ceil(Math.sqrt(berkas.length)))

    let kolom = 0
    let barisX = mulaiDi.x
    let barisY = mulaiDi.y
    let tinggiBaris = 0

    for (const f of berkas) {
      try {
        const assetId = await unggahAset(f, projectId)
        const gambar = await ukuranGambar(f)

        createNode(doc, {
          type: 'image', page: pageAktif, assetId,
          x: barisX, y: barisY, w: gambar.w, h: gambar.h,
          name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Gambar',
        })

        barisX += gambar.w + JARAK
        tinggiBaris = Math.max(tinggiBaris, gambar.h)
        kolom += 1

        if (kolom >= PER_BARIS) {
          kolom = 0
          barisX = mulaiDi.x
          barisY += tinggiBaris + JARAK
          tinggiBaris = 0
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Gagal mengunggah')
      }
    }
  }

  const jalankanAksi = (a: Aksi) => {
    if (a === 'gambar') berkasRef.current?.click()
  }

  /* Berkas titipan dari tombol Impor di daftar kanvas.
     Ditaruh SEKALI saja — `sudahTaruh` mencegah gambar tersalin berkali-kali
     kalau komponen dirender ulang sebelum induknya sempat mengosongkan prop. */
  const sudahTaruhRef = useRef(false)
  useEffect(() => {
    if (!berkasAwal?.length || sudahTaruhRef.current) return
    sudahTaruhRef.current = true
    void (async () => {
      await taruhGambar(berkasAwal)
      onBerkasAwalSelesai?.()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berkasAwal])

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    // Aturan pemilahan dipakai bersama dengan tombol impor (lib/impor.ts),
    // supaya seret-lepas dan menu tidak berbeda perilaku.
    const { dipakai, fig, ditolak } = pilahBerkas([...e.dataTransfer.files])
    if (fig.length) alert(PESAN_FIG)
    if (ditolak.length) alert(pesanTakDidukung(ditolak[0]))
    if (dipakai.length === 0) return

    const kotak = e.currentTarget.getBoundingClientRect()
    const dunia = screenToWorld(viewport, e.clientX - kotak.left, e.clientY - kotak.top)

    // Penata yang sama dengan tombol impor — seret-lepas tidak boleh
    // menghasilkan tata letak yang berbeda.
    await tempatkanBerkas(dipakai, dunia)
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

      // Dalam mode potong, roda menskalakan ISI gambar (bukan zoom kanvas),
      // dipusatkan di kursor. Faktor sama dengan zoom kanvas agar terasa sama.
      const idCrop = cropIdRef.current
      if (idCrop) {
        const n = readNode(doc, idCrop)
        if (n && n.crop) {
          const dunia = screenToWorld(viewport, sx, sy)
          const fx = Math.min(1, Math.max(0, (dunia.x - n.x) / n.w))
          const fy = Math.min(1, Math.max(0, (dunia.y - n.y) / n.h))
          updateNode(doc, idCrop, { crop: skalaCrop(n.crop, Math.exp(-e.deltaY * 0.01), fx, fy) })
        }
        return
      }

      // Mode potong ISI: roda menskalakan isi (seragam) di sekitar kursor.
      const idIsi = cropIsiIdRef.current
      if (idIsi) {
        const n = readNode(doc, idIsi)
        if (n && n.crop) {
          const dunia = screenToWorld(viewport, sx, sy)
          const fx = (dunia.x - n.x) / n.w
          const fy = (dunia.y - n.y) / n.h
          updateNode(doc, idIsi, { crop: skalaIsi(n.crop, Math.exp(-e.deltaY * 0.01), fx, fy) })
        }
        return
      }

      if (e.ctrlKey || e.metaKey) {
        setViewport((vp) => zoomAt(vp, sx, sy, Math.exp(-e.deltaY * 0.01)))
      } else {
        setViewport((vp) => panBy(vp, -e.deltaX, -e.deltaY))
      }
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [doc, viewport])

  useEffect(() => {
    const turun = (e: KeyboardEvent) => {
      // Jangan bajak papan ketik saat pengguna sedang mengetik
      // di panel properti atau mengganti nama layer.
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return

      // Mode potong menahan seluruh papan ketik kecuali Enter (simpan) dan
      // Escape (batal). Tanpa ini, tombol Delete/tool/anak-panah akan beraksi
      // pada node yang sedang dipotong.
      if (cropIdRef.current) {
        if (e.code === 'Enter') { e.preventDefault(); keluarCrop(true) }
        else if (e.code === 'Escape') { e.preventDefault(); keluarCrop(false) }
        return
      }

      // Mode potong isi: Enter simpan, Escape batal.
      if (cropIsiIdRef.current) {
        if (e.code === 'Enter') { e.preventDefault(); keluarCropIsi(true) }
        else if (e.code === 'Escape') { e.preventDefault(); keluarCropIsi(false) }
        return
      }

      // Menggambar Pen: Enter menyelesaikan jalur terbuka, Escape membatalkan.
      // Tombol lain ditelan agar tidak mengganti alat atau menghapus di
      // tengah menggambar.
      if (penPtsRef.current) {
        if (e.code === 'Enter') { e.preventDefault(); finalisasiPen(penPtsRef.current, false) }
        else if (e.code === 'Escape') { e.preventDefault(); buangPen() }
        return
      }

      // Mode sunting jalur: Delete menghapus anchor terpilih, Enter/Escape
      // keluar. Tombol lain ditelan.
      if (penEditIdRef.current) {
        if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); hapusAnchorTerpilih() }
        else if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); keluarSuntingPen() }
        return
      }

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

      // Cermin cepat: Shift+H mendatar, Shift+V tegak — pada semua objek
      // terpilih. Diperiksa sebelum pemetaan tool agar tidak ikut mengganti
      // alat (KeyH=tangan, KeyV=pilih dipicu tanpa Shift).
      if (!cmd && e.shiftKey && (e.code === 'KeyH' || e.code === 'KeyV')) {
        e.preventDefault()
        const sumbuX = e.code === 'KeyH'
        doc.transact(() => {
          for (const id of selection) {
            const n = readNode(doc, id)
            if (n) updateNode(doc, id, sumbuX ? { flipX: !n.flipX } : { flipY: !n.flipY })
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
  }, [doc, selection, undo, keluarCrop, finalisasiPen, buangPen, hapusAnchorTerpilih, keluarSuntingPen, keluarCropIsi])

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
        ref={berkasRef} type="file" accept={ACCEPT_IMPOR} multiple hidden
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
          style={{ position: 'relative', cursor: spasi ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <PengukurTeks doc={doc} store={store} page={pageAktif} pageAwal={pageAwal} />
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
            onDoubleClick={onDoubleClick}
            tanpaKlipId={cropIsiId}
            overlay={
              <>
                {cropId ? (
                  <CropOverlay
                    store={store}
                    doc={doc}
                    id={cropId}
                    viewport={viewport}
                    onSelesai={() => keluarCrop(true)}
                  />
                ) : penEditId ? (
                  <PathEditOverlay
                    store={store}
                    doc={doc}
                    id={penEditId}
                    viewport={viewport}
                    sel={penSel}
                    onPilih={setPenSel}
                    onSelesai={keluarSuntingPen}
                  />
                ) : cropIsiId ? (
                  <ContentCropOverlay
                    store={store}
                    doc={doc}
                    id={cropIsiId}
                    viewport={viewport}
                    onSelesai={() => keluarCropIsi(true)}
                  />
                ) : (
                  <SelectionOverlay
                    store={store}
                    selection={selection}
                    viewport={viewport}
                    preview={preview}
                    onHandleDown={onHandleDown}
                    onRotateDown={onRotateDown}
                  />
                )}
                <Cursors peers={peers} viewport={viewport} />
                {/* Judul frame — di lapisan layar supaya ukurannya tetap
                    berapa pun zoom-nya. Lihat catatan di FrameLabels. */}
                <FrameLabels store={store} viewport={viewport} page={pageAktif} pageAwal={pageAwal} />
                <Marquee rect={marquee ? worldRectKeLayar(marquee, viewport) : null} />

                {/* Pratinjau coretan yang sedang digambar. Digambar di
                    lapisan layar (bukan dunia) supaya tidak perlu menunggu
                    node dibuat — garisnya mengikuti kursor seketika. */}
                {coretPratinjau && coretPratinjau.length >= 4 && (
                  <path
                    d={coretPratinjau
                      .reduce<string[]>((keluar, _n, i) => {
                        if (i % 2) return keluar
                        const p = worldRectKeLayar(
                          { x: coretPratinjau[i], y: coretPratinjau[i + 1], w: 0, h: 0 },
                          viewport,
                        )
                        keluar.push(`${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
                        return keluar
                      }, [])
                      .join(' ')}
                    fill="none"
                    stroke={warnaCoretRef.current}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                )}

                {/* Pratinjau jalur Pen yang sedang digambar: jalur yang sudah
                    jadi, ruas putus-putus ke kursor, dan titik anchor (yang
                    pertama disorot sebagai sasaran menutup jalur). */}
                {(tool === 'pen' || tool === 'textpath') && penPts && penPts.length > 0 && (
                  <g pointerEvents="none">
                    <path
                      d={dJalurPen(penPts, false, (x, y) => worldToScreen(viewport, x, y))}
                      fill="none" stroke="var(--accent)" strokeWidth={1.5}
                      strokeLinecap="round" strokeLinejoin="round"
                    />
                    {penCursor && (
                      <line
                        x1={worldToScreen(viewport, penPts[penPts.length - 1].x, penPts[penPts.length - 1].y).x}
                        y1={worldToScreen(viewport, penPts[penPts.length - 1].x, penPts[penPts.length - 1].y).y}
                        x2={worldToScreen(viewport, penCursor.x, penCursor.y).x}
                        y2={worldToScreen(viewport, penCursor.x, penCursor.y).y}
                        stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3"
                      />
                    )}
                    {penPts.map((p, i) => {
                      const s = worldToScreen(viewport, p.x, p.y)
                      const pertama = i === 0
                      return (
                        <circle
                          key={i} cx={s.x} cy={s.y} r={pertama ? 5 : 3.5}
                          fill={pertama ? 'var(--accent)' : 'var(--surface-0)'}
                          stroke="var(--accent)" strokeWidth={1.5}
                        />
                      )
                    })}
                  </g>
                )}

                {/* Pin komentar — selalu tampak (di semua mode), ukuran tetap. */}
                <CommentPins
                  komentar={komentar}
                  viewport={viewport}
                  page={pageAktif}
                  openId={openKomentar}
                  onBuka={setOpenKomentar}
                />
              </>
            }
          />
          {openKomentar && (() => {
            const k = komentar.find((c) => c.id === openKomentar)
            return k ? (
              <CommentPopover
                key={k.id}
                doc={doc}
                viewport={viewport}
                komentar={k}
                onTutup={() => setOpenKomentar(null)}
              />
            ) : null
          })()}
        </div>

        {/* Alat gambar — pindah dari header ke sisi kanan sebagai ikon. */}
        <div
          className="flex flex-col items-center"
          style={{ padding: '8px 6px', borderLeft: '1px solid var(--line)', background: 'var(--surface-1)' }}
        >
          <Toolbar tool={tool} onTool={setTool} onAksi={jalankanAksi} />
        </div>

        <PropertiesPanel
          doc={doc}
          store={store}
          selection={selection}
          cropId={cropId}
          onCrop={masukCrop}
          onSelesaiCrop={() => keluarCrop(true)}
          onPresetRasio={(id, rasio) => {
            const n = readNode(doc, id)
            if (!n || !n.crop) return
            const { kotak, crop } = snapRasio(n, n.crop, rasio)
            updateNode(doc, id, { x: kotak.x, y: kotak.y, w: kotak.w, h: kotak.h, crop })
          }}
          onResetCrop={(id) => {
            hapusFieldNode(doc, id, 'crop')
            if (cropIdRef.current === id) keluarCrop(true)
          }}
          penEditId={penEditId}
          onSuntingJalur={masukSuntingPen}
          onSelesaiSunting={keluarSuntingPen}
          onHapusAnchor={hapusAnchorTerpilih}
          idTeksBaru={idTeksBaru}
          onFokusTeksSelesai={() => setIdTeksBaru(null)}
          cropIsiId={cropIsiId}
          onPotongIsi={masukCropIsi}
          onSelesaiPotongIsi={() => keluarCropIsi(true)}
          onResetPotongIsi={(id) => {
            hapusFieldNode(doc, id, 'crop')
            if (cropIsiIdRef.current === id) keluarCropIsi(true)
          }}
        />
      </div>
    </div>
  )
}
