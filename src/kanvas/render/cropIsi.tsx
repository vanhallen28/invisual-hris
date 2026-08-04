import type { ReactNode } from 'react'
import type { SceneNode } from '@/kanvas/doc/types'

/**
 * Logika "crop isi" (potong isi) untuk node NON-GAMBAR, dipakai bersama oleh
 * render kanvas (NodeView) DAN ekspor (frameKeSvg) supaya hasil di layar sama
 * persis dengan hasil ekspor. Gambar memakai crop-nya sendiri di dalam Shape;
 * modul ini hanya untuk non-gambar (termasuk anak dari grup ber-crop).
 */

type Kotak = { x: number; y: number; w: number; h: number }
type Crop = { ix: number; iy: number; iw: number; ih: number }

/** Transform: memetakan isi dari kotak node ke rect crop; scale SERAGAM (iw)
 *  agar bentuk/teks tak terdistorsi. */
export function transformCropIsi(kotak: Kotak, crop: Crop): string {
  const tx = kotak.x * (1 - crop.iw) + crop.ix * kotak.w
  const ty = kotak.y * (1 - crop.iw) + crop.iy * kotak.h
  return `translate(${tx} ${ty}) scale(${crop.iw})`
}

/** Crop-isi yang berlaku untuk sebuah node: miliknya (non-gambar & bukan grup)
 *  ATAU dari grup induknya. Mengembalikan null bila tak ada. */
export function cropIsiBerlaku(
  node: SceneNode,
  induk: SceneNode | null,
): { crop: Crop; kotak: Kotak; cid: string } | null {
  if (node.crop && node.type !== 'image' && node.type !== 'group') {
    return { crop: node.crop, kotak: node, cid: `ci-${node.id}` }
  }
  if (induk && induk.type === 'group' && induk.crop) {
    return { crop: induk.crop, kotak: induk, cid: `cg-${node.id}` }
  }
  return null
}

/** Bungkus elemen dengan transform + KLIP (kondisi final). Dipakai render
 *  normal maupun ekspor. */
export function bungkusCropIsiKlip(el: ReactNode, crop: Crop, kotak: Kotak, cid: string): ReactNode {
  return (
    <g>
      <clipPath id={cid}>
        <rect x={kotak.x} y={kotak.y} width={kotak.w} height={kotak.h} />
      </clipPath>
      <g clipPath={`url(#${cid})`}>
        <g transform={transformCropIsi(kotak, crop)}>{el}</g>
      </g>
    </g>
  )
}
