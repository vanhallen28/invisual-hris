import type { NodeType } from '@/kanvas/doc/types'

export type Tool = 'select' | 'hand' | 'frame' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star' | 'text'

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
}

/**
 * Tool yang menghasilkan node saat diseret. 'select' dan 'hand' tidak
 * menggambar apa pun, jadi keduanya mengembalikan null.
 */
export function toolToNodeType(tool: Tool): NodeType | null {
  return tool === 'select' || tool === 'hand' ? null : tool
}
