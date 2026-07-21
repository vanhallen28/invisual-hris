'use client'

import { useState } from 'react'

const gayaInput: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-0)',
  padding: '3px 6px',
  width: '100%',
}

export function NumField({
  label, value, onCommit, step = 1,
}: {
  label: string
  value: number
  onCommit: (n: number) => void
  step?: number
}) {
  const [draf, setDraf] = useState(String(value))

  // Nilai luar berubah saat objek digeser atau di-resize. onChange
  // hanya menyentuh draf, tidak pernah value, jadi sinkronisasi ini
  // tidak akan bertabrakan dengan pengetikan pengguna. Disinkronkan
  // saat render (pola resmi React "menyesuaikan state ketika prop
  // berubah") alih-alih di effect, supaya tidak memicu render berantai.
  const [nilaiLama, setNilaiLama] = useState(value)
  if (value !== nilaiLama) {
    setNilaiLama(value)
    setDraf(String(Math.round(value * 100) / 100))
  }

  function kirim() {
    const n = Number(draf)
    if (Number.isFinite(n)) onCommit(n)
    else setDraf(String(value))
  }

  return (
    <label className="flex items-center gap-1.5">
      <span className="num" style={{ color: 'var(--text-2)', width: 14 }}>{label}</span>
      <input
        className="num"
        type="number"
        step={step}
        value={draf}
        onChange={(e) => setDraf(e.target.value)}
        onBlur={kirim}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        style={gayaInput}
      />
    </label>
  )
}

export function ColorField({
  label, value, onCommit,
}: {
  label: string
  value: string
  onCommit: (v: string) => void
}) {
  const transparan = value === 'transparent'
  return (
    <label className="flex items-center gap-1.5">
      <span className="num" style={{ color: 'var(--text-2)', width: 14 }}>{label}</span>
      <input
        type="color"
        value={transparan ? '#000000' : value}
        onChange={(e) => onCommit(e.target.value)}
        style={{ ...gayaInput, padding: 0, height: 22, width: 28 }}
      />
      <span className="num" style={{ color: 'var(--text-1)' }}>
        {transparan ? 'none' : value}
      </span>
    </label>
  )
}
