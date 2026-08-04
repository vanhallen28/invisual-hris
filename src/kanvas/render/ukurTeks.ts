// Pengukuran & pembungkusan baris teks memakai Canvas 2D. Dipakai render kanvas
// DAN ekspor (keduanya jalan di browser). Ada fallback kasar bila tak ada DOM.

let ctx: CanvasRenderingContext2D | null = null
function konteks(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  return ctx
}

/** Lebar render sebuah string pada font tertentu (format CSS shorthand). */
export function ukurLebar(teks: string, font: string): number {
  const c = konteks()
  if (!c) return teks.length * (parseInt(font) || 16) * 0.55 // perkiraan tanpa DOM
  c.font = font
  return c.measureText(teks).width
}

/** Membungkus teks ke dalam lebar tertentu (menghormati '\n' sebagai paragraf). */
export function bungkusBaris(teks: string, lebar: number, font: string): string[] {
  const hasil: string[] = []
  const maks = Math.max(1, lebar)
  for (const paragraf of String(teks).split('\n')) {
    if (paragraf === '') { hasil.push(''); continue }
    let baris = ''
    for (const kata of paragraf.split(' ')) {
      const coba = baris ? baris + ' ' + kata : kata
      if (!baris || ukurLebar(coba, font) <= maks) {
        baris = coba
      } else {
        hasil.push(baris)
        baris = kata
      }
    }
    if (baris) hasil.push(baris)
  }
  return hasil.length ? hasil : ['']
}
