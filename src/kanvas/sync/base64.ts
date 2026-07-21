// btoa/atob dipakai, bukan Buffer: berkas ini diimpor kode yang
// berjalan di browser, dan Next.js tidak mem-polyfill modul Node.
// Keduanya tersedia di browser maupun Node 16+.
export function toBase64(bytes: Uint8Array): string {
  let biner = ''
  const potongan = 0x8000
  // String.fromCharCode(...besar) melampaui batas argumen dan
  // melempar RangeError pada dokumen besar, jadi dipotong-potong.
  for (let i = 0; i < bytes.length; i += potongan) {
    biner += String.fromCharCode(...bytes.subarray(i, i + potongan))
  }
  return btoa(biner)
}

export function fromBase64(text: string): Uint8Array {
  const biner = atob(text)
  const keluar = new Uint8Array(biner.length)
  for (let i = 0; i < biner.length; i++) keluar[i] = biner.charCodeAt(i)
  return keluar
}
