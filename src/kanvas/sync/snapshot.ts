import type { SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { keBytea } from './hex'

const JEDA_DIAM_MS = 2000
const BATAS_PAKSA_MS = 30000

export function createSnapshotWriter({
  doc,
  supabase,
  fileId,
  onGalat,
}: {
  doc: Y.Doc
  supabase: SupabaseClient
  fileId: string
  onGalat?: (e: unknown) => void
}) {
  let leader = false
  let kotor = false
  let timerDiam: ReturnType<typeof setTimeout> | null = null
  let timerPaksa: ReturnType<typeof setTimeout> | null = null
  let hidup = true

  async function tulis() {
    if (!hidup || !leader || !kotor) return
    kotor = false

    // Keadaan penuh, bukan selisih. Itu yang membuat penulisan
    // ini idempoten dan aman diulang atau ditimpa leader lain.
    const bytea = keBytea(Y.encodeStateAsUpdate(doc))

    const { error } = await supabase.from('kanvas_files').update({ ydoc: bytea }).eq('id', fileId)

    if (error) {
      // Ditandai kotor lagi supaya percobaan berikutnya menyusul.
      // Editing tidak pernah diblokir oleh kegagalan ini.
      kotor = true
      onGalat?.(error)
    }
  }

  function bersihkanTimer() {
    if (timerDiam !== null) { clearTimeout(timerDiam); timerDiam = null }
    if (timerPaksa !== null) { clearTimeout(timerPaksa); timerPaksa = null }
  }

  async function flush() {
    bersihkanTimer()
    await tulis()
  }

  // Tanpa parameter: update dari jaringan pun ikut ditulis, karena
  // leader bertanggung jawab atas seluruh isi dokumen, bukan hanya
  // suntingannya sendiri.
  const onUpdate = () => {
    kotor = true

    if (timerDiam !== null) clearTimeout(timerDiam)
    timerDiam = setTimeout(() => void flush(), JEDA_DIAM_MS)

    // Batas paksa mencegah dokumen yang disunting terus-menerus
    // tidak pernah tersimpan karena jeda diam tak pernah tercapai.
    if (timerPaksa === null) {
      timerPaksa = setTimeout(() => void flush(), BATAS_PAKSA_MS)
    }
  }

  doc.on('update', onUpdate)

  return {
    setLeader(b: boolean) {
      leader = b
    },
    flush,
    destroy() {
      hidup = false
      doc.off('update', onUpdate)
      bersihkanTimer()
    },
  }
}
