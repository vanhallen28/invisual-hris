import { renderToStaticMarkup } from 'react-dom/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Shape } from '@/kanvas/render/shapes'
import type { SceneNode } from '@/kanvas/doc/types'
import type { Rect } from '@/kanvas/doc/bounds'

/**
 * Gambar diubah jadi data URL sebelum diserialkan. Signed URL
 * akan kedaluwarsa dan mencemari canvas saat dirasterisasi;
 * data URL menghindari keduanya sekaligus.
 */
export async function siapkanAsetDataUrl(
  nodes: SceneNode[],
  supabase: SupabaseClient
): Promise<Record<string, string>> {
  const ids = [...new Set(nodes.filter((n) => n.assetId).map((n) => n.assetId!))]
  const hasil: Record<string, string> = {}

  await Promise.all(
    ids.map(async (id) => {
      const { data } = await supabase.storage.from('assets').createSignedUrl(id, 300)
      if (!data?.signedUrl) return
      const blob = await fetch(data.signedUrl).then((r) => r.blob())
      hasil[id] = await new Promise<string>((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.readAsDataURL(blob)
      })
    })
  )

  return hasil
}

export function frameKeSvg(
  nodes: SceneNode[],
  kotak: Rect,
  asetUrl: Record<string, string>
): string {
  // Komponen Shape yang sama dipakai ulang, bukan generator SVG
  // kedua. Satu perubahan pada bentuk otomatis ikut ke export.
  const isi = nodes
    .map((n) =>
      renderToStaticMarkup(
        <Shape node={n} assetUrl={n.assetId ? asetUrl[n.assetId] : undefined} />
      )
    )
    .join('')

  // Font ditulis literal: variabel CSS tidak ada artinya di dalam
  // berkas SVG yang berdiri sendiri. Font-nya sendiri tidak
  // ditanam, jadi aplikasi lain akan memakai pengganti terdekat.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${kotak.w}" height="${kotak.h}"`,
    ` viewBox="${kotak.x} ${kotak.y} ${kotak.w} ${kotak.h}">`,
    `<style>text{font-family:Archivo,system-ui,sans-serif}</style>`,
    isi,
    `</svg>`,
  ].join('')
}
