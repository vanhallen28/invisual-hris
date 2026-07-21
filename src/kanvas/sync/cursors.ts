import type { RealtimeChannel } from '@supabase/supabase-js'

const EVENT = 'kursor'
const JEDA_MS = 50
const UMUR_MS = 5000

export type Peer = { id: string; nama: string; warna: string; x: number; y: number; pada: number }

/** Warna stabil per pengguna, tanpa perlu disimpan di mana pun. */
export function warnaDariId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return `hsl(${Math.abs(h) % 360} 70% 60%)`
}

export function attachCursors({
  channel,
  saya,
  onUbah,
}: {
  channel: RealtimeChannel
  saya: { id: string; nama: string }
  onUbah: (peers: Peer[]) => void
}) {
  const peers = new Map<string, Peer>()
  let terakhirKirim = 0
  let terakhirPos: { x: number; y: number } | null = null

  function siarkan() {
    onUbah([...peers.values()])
  }

  channel.on('broadcast', { event: EVENT }, ({ payload }) => {
    const p = payload as Omit<Peer, 'pada' | 'warna'>
    if (p.id === saya.id) return
    peers.set(p.id, { ...p, warna: warnaDariId(p.id), pada: Date.now() })
    siarkan()
  })

  // Kursor yang berhenti mengirim dianggap pergi. Menutup kasus
  // tab yang ditutup paksa, yang tidak memicu unsubscribe.
  const sapu = setInterval(() => {
    const batas = Date.now() - UMUR_MS
    let berubah = false
    for (const [id, p] of peers) {
      if (p.pada < batas) {
        peers.delete(id)
        berubah = true
      }
    }
    if (berubah) siarkan()
  }, 1000)

  return {
    /** x dan y dalam satuan dunia, supaya zoom rekan tidak berpengaruh. */
    kirim(x: number, y: number) {
      // Hanya kirim saat benar-benar bergerak. Kursor adalah
      // pendorong biaya utama tagihan Realtime.
      if (terakhirPos && terakhirPos.x === x && terakhirPos.y === y) return
      const sekarang = Date.now()
      if (sekarang - terakhirKirim < JEDA_MS) return
      terakhirKirim = sekarang
      terakhirPos = { x, y }
      channel.send({
        type: 'broadcast',
        event: EVENT,
        payload: { id: saya.id, nama: saya.nama, x, y },
      })
    },
    destroy() {
      clearInterval(sapu)
      peers.clear()
    },
  }
}
