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

export function ukuranGambar(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      // Dibatasi supaya foto 6000px tidak masuk kanvas seukuran layar penuh
      const skala = Math.min(1, 600 / Math.max(img.width, img.height))
      resolve({ w: Math.round(img.width * skala), h: Math.round(img.height * skala) })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ w: 200, h: 200 })
    }
    img.src = url
  })
}
