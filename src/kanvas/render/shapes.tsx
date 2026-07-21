import type { SceneNode } from '@/kanvas/doc/types'
import { titikBangun, titikKeSvg } from '@/kanvas/doc/polygon'
import { ImageShape } from './ImageShape'

/**
 * Murni. Tidak mengimpor Yjs maupun store, sehingga setiap bentuk
 * bisa diuji dengan objek biasa.
 */
export function Shape({
  node,
  assetUrl,
}: {
  node: SceneNode
  assetUrl?: string
}) {
  if (!node.visible) return null

  const umum = {
    fill: node.fill,
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
    opacity: node.opacity,
  }

  // Rotasi diterapkan di sekitar pusat node, bukan titik asalnya.
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  const transform = node.rotation ? `rotate(${node.rotation} ${cx} ${cy})` : undefined

  switch (node.type) {
    case 'frame':
    case 'rect':
      return (
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          rx={node.radius || undefined}
          transform={transform}
          {...umum}
        />
      )

    case 'ellipse':
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={node.w / 2}
          ry={node.h / 2}
          transform={transform}
          {...umum}
        />
      )

    case 'line':
      return (
        <line
          x1={node.x}
          y1={node.y}
          x2={node.x + node.w}
          y2={node.y + node.h}
          transform={transform}
          stroke={node.stroke === 'transparent' ? node.fill : node.stroke}
          strokeWidth={node.strokeWidth || 1}
          opacity={node.opacity}
        />
      )

    case 'polygon':
    case 'star':
      return (
        <polygon
          points={titikKeSvg(titikBangun(node))}
          transform={transform}
          fill={node.fill}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth}
          opacity={node.opacity}
        />
      )

    case 'arrow': {
      // Panah = garis biasa ditambah mata panah di ujung. Kepalanya
      // digambar sebagai poligon yang diputar mengikuti arah garis,
      // bukan marker SVG, supaya ukurannya tidak ikut tebal garis
      // dan tetap terbaca saat garisnya tipis.
      const x1 = node.x
      const y1 = node.y
      const x2 = node.x + node.w
      const y2 = node.y + node.h
      const warna = node.stroke === 'transparent' ? node.fill : node.stroke
      const tebal = node.strokeWidth || 1
      const sudut = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
      const kepala = Math.max(6, tebal * 4)

      return (
        <g transform={transform} opacity={node.opacity}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={warna}
            strokeWidth={tebal}
            strokeLinecap="round"
          />
          <polygon
            points={`0,0 ${-kepala},${kepala * 0.42} ${-kepala},${-kepala * 0.42}`}
            fill={warna}
            transform={`translate(${x2} ${y2}) rotate(${sudut})`}
          />
        </g>
      )
    }

    case 'text':
      return (
        <text
          x={node.x}
          y={node.y + node.h}
          transform={transform}
          fill={node.fill}
          opacity={node.opacity}
          style={{ font: '16px var(--font-ui), sans-serif' }}
        >
          {node.text ?? ''}
        </text>
      )

    case 'image':
      // Saat assetUrl diberikan, gambar dirender langsung tanpa
      // pengambilan async. Export memerlukan ini karena
      // renderToStaticMarkup tidak menjalankan efek.
      return assetUrl ? (
        <image
          href={assetUrl}
          x={node.x} y={node.y} width={node.w} height={node.h}
          transform={transform} opacity={node.opacity}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <ImageShape node={node} transform={transform} />
      )

    case 'group':
      // Group tidak menggambar apa pun; anaknya yang digambar.
      return null
  }
}
