/** Postgres menerima literal bytea dalam bentuk '\xdeadbeef'. */
export function keBytea(bytes: Uint8Array): string {
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return `\\x${hex}`
}

/** PostgREST mengembalikan bytea sebagai teks heksadesimal berawalan '\x'. */
export function dariBytea(teks: string): Uint8Array {
  const hex = teks.startsWith('\\x') ? teks.slice(2) : teks
  const keluar = new Uint8Array(hex.length / 2)
  for (let i = 0; i < keluar.length; i++) {
    keluar[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return keluar
}
