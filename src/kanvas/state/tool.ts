import type { NodeType } from '@/kanvas/doc/types'

export type Tool =
  | 'select' | 'hand' | 'frame' | 'rect' | 'ellipse' | 'line' | 'arrow'
  | 'polygon' | 'star' | 'text' | 'sticky' | 'draw' | 'pen' | 'textpath' | 'comment'

/** Pemetaan huruf ke tool, mengikuti konvensi editor grafis. */
export const TOOL_KEYS: Record<string, Tool> = {
  KeyV: 'select',
  KeyH: 'hand',
  KeyF: 'frame',
  KeyR: 'rect',
  KeyO: 'ellipse',
  KeyL: 'line',
  KeyA: 'arrow',
  KeyT: 'text',
  KeyS: 'sticky',
  KeyP: 'draw',
  KeyN: 'pen',
  KeyC: 'comment',
}

export const TOOL_LABEL: Record<Tool, string> = {
  select: 'Pilih  V',
  hand: 'Geser  H',
  frame: 'Frame  F',
  rect: 'Persegi  R',
  ellipse: 'Elips  O',
  line: 'Garis  L',
  arrow: 'Panah  A',
  polygon: 'Poligon',
  star: 'Bintang',
  text: 'Teks  T',
  sticky: 'Catatan  S',
  draw: 'Coret  P',
  pen: 'Pen  N',
  textpath: 'Teks di jalur',
  comment: 'Komentar  C',
}

/**
 * Tool yang menghasilkan node saat diseret. 'select' dan 'hand' tidak
 * menggambar apa pun, jadi keduanya mengembalikan null. 'pen' & 'textpath'
 * juga null (jalurnya lewat rangkaian klik). 'comment' juga null: komentar
 * bukan node scene, melainkan disimpan di map terpisah.
 */
export function toolToNodeType(tool: Tool): NodeType | null {
  return tool === 'select' || tool === 'hand' || tool === 'pen' || tool === 'textpath' || tool === 'comment'
    ? null
    : tool
}
