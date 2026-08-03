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
   * Titik-titik coretan tangan, relatif terhadap x/y node.
   * Disimpan relatif supaya coretan bisa digeser dan diubah ukurannya
   * seperti node lain tanpa menghitung ulang setiap titik.
   */
  points?: number[]
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
}
