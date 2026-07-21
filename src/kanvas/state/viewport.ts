/** x dan y adalah koordinat dunia yang berada di titik asal layar. */
export type Viewport = { x: number; y: number; zoom: number }

export const IDENTITY_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 64

export function screenToWorld(vp: Viewport, screenX: number, screenY: number) {
  return { x: screenX / vp.zoom + vp.x, y: screenY / vp.zoom + vp.y }
}

export function worldToScreen(vp: Viewport, worldX: number, worldY: number) {
  return { x: (worldX - vp.x) * vp.zoom, y: (worldY - vp.y) * vp.zoom }
}

export function zoomAt(
  vp: Viewport,
  screenX: number,
  screenY: number,
  factor: number
): Viewport {
  // Clamp dihitung lebih dulu, lalu offset diturunkan dari zoom
  // yang sudah terpotong. Urutan sebaliknya membuat kanvas
  // melompat begitu menyentuh batas.
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor))
  const titik = screenToWorld(vp, screenX, screenY)

  return {
    zoom,
    x: titik.x - screenX / zoom,
    y: titik.y - screenY / zoom,
  }
}

export function panBy(vp: Viewport, screenDx: number, screenDy: number): Viewport {
  return { ...vp, x: vp.x - screenDx / vp.zoom, y: vp.y - screenDy / vp.zoom }
}

/** Mengubah persegi dari satuan dunia ke piksel layar. */
export function worldRectKeLayar(
  r: { x: number; y: number; w: number; h: number },
  vp: Viewport
) {
  const p = worldToScreen(vp, r.x, r.y)
  return { x: p.x, y: p.y, w: r.w * vp.zoom, h: r.h * vp.zoom }
}
