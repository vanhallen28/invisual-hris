import type * as Y from 'yjs'

export const NODES_KEY = 'nodes'
export const ROOT = 'root'

export type NodeType =
  | 'frame' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star'
  | 'text' | 'image' | 'group'
  /** Catatan tempel ala FigJam: kotak berwarna berisi teks yang membungkus sendiri. */
  | 'sticky'
  /** Coretan tangan bebas: deretan titik, bukan bentuk geometris. */
  | 'draw'
  /** Jalur bezier (Pen): deretan anchor dengan handle lengkung, bisa tertutup. */
  | 'pen'
  /** Teks yang mengikuti sebuah jalur bezier. Memakai `path` + `text`. */
  | 'textpath'

/**
 * Satu anchor pada jalur Pen. Koordinat berada di RUANG SUMBER (sama seperti
 * `points` pada `draw`) lalu diskalakan oleh kotak node saat dirender. Handle
 * masuk/keluar bersifat opsional: bila tak ada, titik itu SUDUT (segmen lurus);
 * bila ada, titik itu MULUS (segmen melengkung).
 */
export type PenPoint = {
  x: number
  y: number
  /** Handle masuk (absolut, ruang sumber). */
  hix?: number
  hiy?: number
  /** Handle keluar (absolut, ruang sumber). */
  hox?: number
  hoy?: number
}

/** Satu node di dalam Y.Doc. Kunci apa pun bisa berubah sendiri-sendiri. */
export type YNode = Y.Map<unknown>

export interface SceneNode {
  id: string
  type: NodeType
  parent: string
  order: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  radius: number
  name: string
  visible: boolean
  locked: boolean
  text?: string
  assetId?: string
  /** Halaman tempat node ini berada. Kosong = halaman pertama. */
  page?: string
  /** Jumlah sisi poligon, atau jumlah sudut bintang. */
  sides?: number

  /* ── Tipografi (teks & catatan tempel) ─────────────────────────── */
  fontSize?: number
  fontFamily?: string
  /** 400 biasa, 600 medium, 700 tebal. */
  fontWeight?: number
  /** Perataan mendatar isi teks. */
  align?: 'left' | 'center' | 'right'

  /* ── Cermin ────────────────────────────────────────────────────── */
  flipX?: boolean
  flipY?: boolean

  /**
   * Potongan gambar non-destruktif ala Figma. Rect gambar dinyatakan
   * sebagai PECAHAN kotak node: gambar digambar pada
   * (x + ix·w, y + iy·h, iw·w, ih·h) lalu di-clip ke kotak node.
   *
   * Tak ada `crop` = gambar tampil penuh seperti sebelumnya. Rect selalu
   * MENUTUP kotak (ix≤0, iy≤0, ix+iw≥1, iy+ih≥1) dan mempertahankan rasio
   * asli gambar, sehingga tidak pernah ada celah kosong maupun distorsi.
   */
  crop?: { ix: number; iy: number; iw: number; ih: number }

  /**
   * Titik-titik coretan tangan, relatif terhadap x/y node.
   * Disimpan relatif supaya coretan bisa digeser dan diubah ukurannya
   * seperti node lain tanpa menghitung ulang setiap titik.
   */
  points?: number[]

  /**
   * Jalur bezier untuk node `pen`. `pts` adalah anchor+handle di ruang sumber,
   * diskalakan oleh kotak node saat render (sama pola dengan `points`).
   * `closed` menandai jalur tertutup (mendapat perintah Z dan bisa diisi warna).
   */
  path?: { pts: PenPoint[]; closed: boolean }
}

export type NodeInit = { type: NodeType } & Partial<Omit<SceneNode, 'id' | 'type' | 'order'>>

export const DEFAULTS = {
  parent: ROOT,
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  rotation: 0,
  fill: '#d4d4d8',
  stroke: 'transparent',
  strokeWidth: 0,
  opacity: 1,
  radius: 0,
  visible: true,
  locked: false,
} as const

export const DEFAULT_NAME: Record<NodeType, string> = {
  frame: 'Frame',
  rect: 'Persegi',
  ellipse: 'Elips',
  line: 'Garis',
  arrow: 'Panah',
  polygon: 'Poligon',
  star: 'Bintang',
  text: 'Teks',
  image: 'Gambar',
  group: 'Grup',
  sticky: 'Catatan',
  draw: 'Coretan',
  pen: 'Jalur',
  textpath: 'Teks jalur',
}
