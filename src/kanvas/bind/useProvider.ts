'use client'

import { useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { createBrowserSupabase } from '@/kanvas/lib/supabase'
import { createProvider, type StatusSync } from '@/kanvas/sync/provider'
import { attachCursors, type Peer } from '@/kanvas/sync/cursors'
import { createSnapshotWriter } from '@/kanvas/sync/snapshot'
import { pilihLeader } from '@/kanvas/sync/leader'
import type { Hadir } from '@/kanvas/ui/PresenceBar'

export function useProvider({
  doc,
  fileId,
  saya,
}: {
  doc: Y.Doc
  fileId: string
  saya: { id: string; nama: string }
}) {
  const [status, setStatus] = useState<StatusSync>('menyambung')
  const [peers, setPeers] = useState<Peer[]>([])
  const [hadir, setHadir] = useState<Hadir[]>([])
  const kirimKursor = useRef<(x: number, y: number) => void>(() => {})

  // Diurai jadi primitif supaya dependensi efek stabil. Mengoper
  // objek `saya` langsung akan menyambung ulang channel di setiap
  // render, karena literalnya baru setiap kali.
  const sayaId = saya.id
  const sayaNama = saya.nama

  useEffect(() => {
    const supabase = createBrowserSupabase()
    const aku = { id: sayaId, nama: sayaNama }

    // klienId diterima sebagai argumen, bukan dibaca dari
    // `provider`. Merujuk `provider` di dalam inisialisasinya
    // sendiri kebetulan aman di sini, tapi menyisakan jebakan
    // TDZ begitu ada yang memanggil onSubscribed lebih awal.
    const provider = createProvider({
      doc,
      supabase,
      fileId,
      onStatus: setStatus,
      onSubscribed: (channel, klienId) =>
        void channel.track({ id: aku.id, nama: aku.nama, klienId }),
    })

    const penulis = createSnapshotWriter({
      doc,
      supabase,
      fileId,
      onGalat: (e) => console.error('[snapshot] gagal menulis', e),
    })

    // Seluruh .on() wajib terdaftar sebelum connect(), karena
    // Supabase mengunci daftar listener saat channel di-subscribe.
    const kursor = attachCursors({ channel: provider.channel, saya: aku, onUbah: setPeers })
    kirimKursor.current = kursor.kirim

    provider.channel.on('presence', { event: 'sync' }, () => {
      const state = provider.channel.presenceState<Hadir & { klienId: string }>()
      const semua = Object.values(state).flat()

      // Dedup: satu orang dengan dua tab menghasilkan dua entri.
      const unik = new Map<string, Hadir>()
      for (const v of semua) unik.set(v.id, { id: v.id, nama: v.nama })
      setHadir([...unik.values()])

      // Setiap klien menghitung leader dari daftar yang sama.
      penulis.setLeader(pilihLeader(semua.map((v) => v.klienId)) === provider.klienId)
    })

    provider.connect()

    // visibilitychange menyala sebelum halaman ditutup di hampir
    // semua kasus, dan di titik itu penulisan async masih normal.
    // Ini menutup celah kehilangan dua detik terakhir suntingan.
    const onSembunyi = () => {
      if (document.visibilityState === 'hidden') void penulis.flush()
    }
    document.addEventListener('visibilitychange', onSembunyi)

    return () => {
      document.removeEventListener('visibilitychange', onSembunyi)
      void penulis.flush()
      penulis.destroy()
      kursor.destroy()
      provider.destroy()
    }
  }, [doc, fileId, sayaId, sayaNama])

  return { status, peers, hadir, kirimKursor }
}
