import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { fromBase64, toBase64 } from './base64'

const EVENT = 'y'
const JEDA_FLUSH_MS = 50
const BATAS_PESAN = 700_000 // di bawah batas 1 MB Realtime

export type StatusSync = 'menyambung' | 'tersambung' | 'terputus'

type Pesan =
  | { t: 'sv'; dari: string; sv: string; balas: boolean }
  | { t: 'upd'; dari: string; upd: string }

export function topikFile(fileId: string) {
  return `file:${fileId}`
}

export function createProvider({
  doc,
  supabase,
  fileId,
  onStatus,
  onSubscribed,
}: {
  doc: Y.Doc
  supabase: SupabaseClient
  fileId: string
  onStatus?: (s: StatusSync) => void
  onSubscribed?: (channel: RealtimeChannel, klienId: string) => void
}): {
  channel: RealtimeChannel
  klienId: string
  connect: () => void
  destroy: () => void
} {
  const klien = crypto.randomUUID()
  const antre: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let hidup = true

  const channel = supabase.channel(topikFile(fileId), {
    config: { private: true, broadcast: { self: false } },
  })

  function kirim(p: Pesan) {
    const muatan = JSON.stringify(p)
    if (muatan.length > BATAS_PESAN) {
      // Gagal berisik lebih baik daripada dokumen yang diam-diam
      // menyimpang karena satu pesan ditolak server.
      console.error(
        `[sync] pesan ${muatan.length} byte melewati batas aman; dokumen mungkin tidak tersinkron`
      )
      return
    }
    channel.send({ type: 'broadcast', event: EVENT, payload: p })
  }

  function flush() {
    timer = null
    if (antre.length === 0) return
    // Digabung jadi satu update, sehingga satu detik drag
    // menghasilkan ~20 pesan, bukan ratusan.
    const gabungan = Y.mergeUpdates(antre.splice(0))
    kirim({ t: 'upd', dari: klien, upd: toBase64(gabungan) })
  }

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    // Update dari jaringan tidak boleh dipantulkan balik.
    if (origin === 'remote' || !hidup) return
    antre.push(update)
    if (timer === null) timer = setTimeout(flush, JEDA_FLUSH_MS)
  }

  doc.on('update', onUpdate)

  channel.on('broadcast', { event: EVENT }, ({ payload }) => {
    const p = payload as Pesan
    if (p.dari === klien) return

    if (p.t === 'upd') {
      Y.applyUpdate(doc, fromBase64(p.upd), 'remote')
      return
    }

    // Seseorang meminta selisih. Kirim apa yang dia belum punya.
    const selisih = Y.encodeStateAsUpdate(doc, fromBase64(p.sv))
    if (selisih.length > 0) {
      kirim({ t: 'upd', dari: klien, upd: toBase64(selisih) })
    }

    // Balas dengan state vector sendiri sekali saja. Tanpa
    // balas:false, dua klien akan saling bertukar sv tanpa henti.
    if (p.balas) {
      kirim({ t: 'sv', dari: klien, sv: toBase64(Y.encodeStateVector(doc)), balas: false })
    }
  })

  function handshake() {
    kirim({ t: 'sv', dari: klien, sv: toBase64(Y.encodeStateVector(doc)), balas: true })
  }

  // subscribe() sengaja TIDAK dipanggil di sini. Supabase melarang
  // subscribe dua kali pada channel yang sama, dan setiap .on()
  // wajib terdaftar sebelum subscribe. Pemanggil perlu ruang untuk
  // memasang listener kursor dan presence dulu, baru connect().
  return {
    channel,
    klienId: klien,

    connect() {
      onStatus?.('menyambung')
      channel.subscribe((status) => {
        if (!hidup) return
        if (status === 'SUBSCRIBED') {
          onStatus?.('tersambung')
          // Dipanggil ulang pada tiap reconnect, bukan hanya sekali.
          // Inilah yang menutup lubang setelah jaringan putus.
          handshake()
          onSubscribed?.(channel, klien)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatus?.('terputus')
        }
      })
    },

    destroy() {
      hidup = false
      doc.off('update', onUpdate)
      if (timer !== null) clearTimeout(timer)
      supabase.removeChannel(channel)
    },
  }
}
