'use client'

import { warnaDariId } from '@/kanvas/sync/cursors'

export type Hadir = { id: string; nama: string }

export function PresenceBar({ hadir, kecuali }: { hadir: Hadir[]; kecuali?: string }) {
  // Avatar diri sendiri tidak ditampilkan — kita sudah tahu siapa kita.
  // Yang berguna hanyalah melihat siapa lagi yang sedang membuka kanvas ini.
  const lain = kecuali ? hadir.filter((h) => h.id !== kecuali) : hadir
  if (lain.length === 0) return null
  return (
    <div className="flex items-center -space-x-1.5">
      {lain.map((h) => (
        <div
          key={h.id}
          title={h.nama}
          className="num flex items-center justify-center"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: warnaDariId(h.id),
            border: '1.5px solid var(--surface-0)',
            color: '#000',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {h.nama.slice(0, 1).toUpperCase()}
        </div>
      ))}
    </div>
  )
}
