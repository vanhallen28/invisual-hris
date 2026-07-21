export async function svgKePng(
  svgText: string,
  w: number,
  h: number,
  skala = 2
): Promise<Blob> {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG gagal dirasterisasi'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * skala))
    canvas.height = Math.max(1, Math.round(h * skala))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D tidak tersedia')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob gagal'))), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
