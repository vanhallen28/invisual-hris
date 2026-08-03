'use client'

import { createBrowserSupabase } from '@/kanvas/lib/supabase'

const MAKS_BYTE = 10 * 1024 * 1024
const TIPE_DIIZINKAN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

export async function unggahAset(file: File, projectId: string): Promise<string> {
  if (!TIPE_DIIZINKAN.includes(file.type)) {
    throw new Error(`Tipe berkas tidak didukung: ${file.type}`)
  }
  if (file.size > MAKS_BYTE) {
    throw new Error('Berkas melebihi 10 MB')
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`

  const supabase = createBrowserSupabase()
  const { error } = await supabase.storage.from('assets').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(`Gagal mengunggah: ${error.message}`)

  // Yang dikembalikan hanya path. Byte-nya tidak pernah masuk
  // Y.Doc — base64 di dalam CRDT akan menembus batas pesan 1 MB
  // dan menggelembungkan dokumen secara permanen.
  return path
}

const MAKS_SISI = 900

/**
 * Ukuran alami SVG dibaca dari berkasnya sendiri.
 *
 * Elemen <img> sering memulangkan ukuran yang salah untuk SVG: kalau
 * atribut width/height tidak ada, sebagian browser memberi 0 atau ukuran
 * bawaan 300×150. Akibatnya hasil impor tampil kecil dan gepeng.
 * viewBox adalah sumber yang benar, jadi dibaca langsung dari teksnya.
 */
async function ukuranSvg(file: File): Promise<{ w: number; h: number } | null> {
  try {
    const teks = await file.text()
    const kepala = teks.slice(0, 4000)

    const angka = (nama: string) => {
      const m = new RegExp(`<svg[^>]*\\s${nama}\\s*=\\s*["']([\\d.]+)`, 'i').exec(kepala)
      return m ? parseFloat(m[1]) : 0
    }
    let w = angka('width')
    let h = angka('height')

    if (!w || !h) {
      const vb = /<svg[^>]*viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(kepala)
      if (vb) { w = parseFloat(vb[1]); h = parseFloat(vb[2]) }
    }
    if (!w || !h) return null
    return { w, h }
  } catch { return null }
}

export async function ukuranGambar(file: File): Promise<{ w: number; h: number }> {
  const muat = (): Promise<{ w: number; h: number } | null> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img.width && img.height ? { w: img.width, h: img.height } : null)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })

  // SVG dibaca dari berkasnya dulu; <img> hanya jadi cadangan.
  const alami =
    (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
      ? (await ukuranSvg(file)) ?? (await muat())
      : (await muat()) ?? (await ukuranSvg(file))) ?? { w: 400, h: 300 }

  // Dibatasi supaya foto 6000px tidak masuk kanvas seukuran layar penuh.
  const skala = Math.min(1, MAKS_SISI / Math.max(alami.w, alami.h))
  return { w: Math.round(alami.w * skala), h: Math.round(alami.h * skala) }
}
