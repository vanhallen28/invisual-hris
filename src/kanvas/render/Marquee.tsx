'use client'

export function Marquee({
  rect,
}: {
  rect: { x: number; y: number; w: number; h: number } | null
}) {
  if (!rect) return null
  return (
    <rect
      x={rect.x} y={rect.y} width={rect.w} height={rect.h}
      fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1}
      pointerEvents="none"
    />
  )
}
