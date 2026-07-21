import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import type { SceneNode } from './types'

export function keyBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b)
}

export function keyAfter(last: string | null): string {
  return generateKeyBetween(last, null)
}

export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  return generateNKeysBetween(a, b, n)
}

/**
 * Pengurutan wajib deterministik lintas klien. Kunci order saja tidak
 * cukup: dua klien yang menyisip di celah yang sama secara bersamaan
 * bisa menghasilkan kunci identik. Tiebreak id membuat urutan tampilan
 * sama di semua layar.
 */
export function sortByOrder<T extends Pick<SceneNode, 'id' | 'order'>>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => {
    if (a.order !== b.order) return a.order < b.order ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}
