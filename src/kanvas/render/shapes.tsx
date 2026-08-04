import type { SceneNode } from '@/kanvas/doc/types'
import { titikBangun, titikKeSvg } from '@/kanvas/doc/polygon'
import { ImageShape, GambarTerpotong } from './ImageShape'
import { dJalurPen } from './penPath'

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

  // Cermin juga berporos di pusat, dan digabung dengan rotasi dalam satu
  // atribut. Kalau dipisah jadi dua elemen, hit-test dan handle seleksi
  // ikut bergeser karena keduanya menghitung dari geometri asli.
  const bagian: string[] = []
  if (node.rotation) bagian.push(`rotate(${node.rotation} ${cx} ${cy})`)
  if (node.flipX || node.flipY) {
    bagian.push(`translate(${cx} ${cy})`)
    bagian.push(`scale(${node.flipX ? -1 : 1} ${node.flipY ? -1 : 1})`)
    bagian.push(`translate(${-cx} ${-cy})`)
  }
  const transform = bagian.length ? bagian.join(' ') : undefined

  // Tipografi bersama untuk teks dan catatan tempel.
  const fs = node.fontSize && node.fontSize > 0 ? node.fontSize : 16
  const ff = node.fontFamily || 'var(--font-ui), sans-serif'
  const fw = node.fontWeight || 400
  const rata = node.align || 'left'
  const anchor = rata === 'center' ? 'middle' : rata === 'right' ? 'end' : 'start'

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

    case 'draw': {
      /* Coretan tangan. Titik disimpan RELATIF terhadap x/y node, lalu
         diskalakan terhadap ukuran node saat digambar — jadi coretan bisa
         digeser dan diubah ukurannya seperti bentuk lain, tanpa perlu
         menulis ulang setiap titik di dokumen. */
      const t = node.points ?? []
      if (t.length < 4) return null

      // Rentang asli dicatat saat coretan dibuat lewat w/h awal. Skala
      // dihitung dari perbandingan ukuran node sekarang terhadap rentang
      // titiknya sendiri, supaya resize terasa wajar.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < t.length; i += 2) {
        if (t[i] < minX) minX = t[i]
        if (t[i] > maxX) maxX = t[i]
        if (t[i + 1] < minY) minY = t[i + 1]
        if (t[i + 1] > maxY) maxY = t[i + 1]
      }
      const lebarAsli = Math.max(1, maxX - minX)
      const tinggiAsli = Math.max(1, maxY - minY)
      const sx = node.w / lebarAsli
      const sy = node.h / tinggiAsli

      const titik: string[] = []
      for (let i = 0; i < t.length; i += 2) {
        const px = node.x + (t[i] - minX) * sx
        const py = node.y + (t[i + 1] - minY) * sy
        titik.push(`${i === 0 ? 'M' : 'L'}${Math.round(px * 100) / 100} ${Math.round(py * 100) / 100}`)
      }

      return (
        <path
          d={titik.join(' ')}
          fill="none"
          stroke={node.stroke && node.stroke !== 'transparent' ? node.stroke : node.fill}
          strokeWidth={node.strokeWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={transform}
          opacity={node.opacity}
        />
      )
    }

    case 'pen': {
      /* Jalur bezier. Anchor+handle disimpan di ruang sumber lalu diskalakan
         ke kotak node — pola yang sama dengan 'draw', sehingga jalur bisa
         digeser, diubah ukuran, dirotasi, dan dicermin seperti bentuk lain. */
      const p = node.path
      if (!p || p.pts.length < 2) return null

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      const catat = (x: number, y: number) => {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      for (const pt of p.pts) {
        catat(pt.x, pt.y)
        if (pt.hix != null && pt.hiy != null) catat(pt.hix, pt.hiy)
        if (pt.hox != null && pt.hoy != null) catat(pt.hox, pt.hoy)
      }
      const sx = node.w / Math.max(1, maxX - minX)
      const sy = node.h / Math.max(1, maxY - minY)
      const petakan = (x: number, y: number) => ({
        x: node.x + (x - minX) * sx,
        y: node.y + (y - minY) * sy,
      })

      const isi = p.closed && node.fill && node.fill !== 'transparent' ? node.fill : 'none'
      return (
        <path
          d={dJalurPen(p.pts, p.closed, petakan)}
          fill={isi}
          stroke={node.stroke && node.stroke !== 'transparent' ? node.stroke : '#ef4444'}
          strokeWidth={node.strokeWidth || 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={transform}
          opacity={node.opacity}
        />
      )
    }

    case 'textpath': {
      /* Teks mengikuti jalur bezier. Jalur diberi id lalu dirujuk <textPath>.
         Warna teks = fill; garis jalur = stroke (default tersembunyi → panduan
         yang bisa dinyalakan). Skala jalur mengikuti kotak node, seperti 'pen'. */
      const p = node.path
      if (!p || p.pts.length < 2) return null

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      const catat = (x: number, y: number) => {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      for (const pt of p.pts) {
        catat(pt.x, pt.y)
        if (pt.hix != null && pt.hiy != null) catat(pt.hix, pt.hiy)
        if (pt.hox != null && pt.hoy != null) catat(pt.hox, pt.hoy)
      }
      const sx = node.w / Math.max(1, maxX - minX)
      const sy = node.h / Math.max(1, maxY - minY)
      const petakan = (x: number, y: number) => ({
        x: node.x + (x - minX) * sx,
        y: node.y + (y - minY) * sy,
      })

      const pid = `tp-${node.id}`
      const ukuran = node.fontSize && node.fontSize > 0 ? node.fontSize : 16
      const keluarga = node.fontFamily || 'var(--font-ui), sans-serif'
      const tebal = node.fontWeight || 400
      const warnaTeks = node.fill && node.fill !== 'transparent' ? node.fill : '#e5e5e5'
      const garisTampak = node.stroke && node.stroke !== 'transparent'
      return (
        <g transform={transform} opacity={node.opacity}>
          <path
            id={pid}
            d={dJalurPen(p.pts, p.closed, petakan)}
            fill="none"
            stroke={garisTampak ? node.stroke : 'none'}
            strokeWidth={node.strokeWidth || 1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text fontSize={ukuran} fontFamily={keluarga} fontWeight={tebal} fill={warnaTeks}>
            <textPath href={`#${pid}`}>{node.text ?? ''}</textPath>
          </text>
        </g>
      )
    }

    case 'sticky': {
      /* Catatan tempel. Teksnya dibungkus MANUAL jadi <tspan> per baris,
         bukan lewat <foreignObject>: ekspor memakai renderToStaticMarkup
         lalu dirasterkan, dan foreignObject tidak ikut tergambar di
         sebagian browser — catatannya akan keluar kosong di PNG. */
      const pad = 14
      const ukuranHuruf = node.fontSize && node.fontSize > 0 ? node.fontSize : 14
      const tinggiBaris = ukuranHuruf * 1.45
      const lebarIsi = Math.max(0, node.w - pad * 2)
      // Lebar rata-rata huruf pada sans-serif ≈ 0,55 × ukuran huruf.
      const maksHuruf = Math.max(1, Math.floor(lebarIsi / (ukuranHuruf * 0.55)))

      const baris: string[] = []
      for (const paragraf of String(node.text ?? '').split('\n')) {
        if (!paragraf) { baris.push(''); continue }
        let kini = ''
        for (const kata of paragraf.split(/\s+/)) {
          const gabung = kini ? `${kini} ${kata}` : kata
          if (gabung.length <= maksHuruf) { kini = gabung; continue }
          if (kini) baris.push(kini)
          // Kata tunggal yang lebih panjang dari lebar catatan dipotong,
          // supaya tidak menjorok keluar kotak.
          let sisa = kata
          while (sisa.length > maksHuruf) { baris.push(sisa.slice(0, maksHuruf)); sisa = sisa.slice(maksHuruf) }
          kini = sisa
        }
        baris.push(kini)
      }

      // Warna teks mengikuti terangnya catatan. Pemilih warna bebas berarti
      // catatan bisa gelap, dan teks gelap di atasnya tak akan terbaca.
      const hx = String(node.fill || '#fde68a').replace('#', '')
      const penuh = hx.length === 3 ? hx.split('').map((c) => c + c).join('') : hx
      const r = parseInt(penuh.slice(0, 2), 16) || 0
      const g = parseInt(penuh.slice(2, 4), 16) || 0
      const b = parseInt(penuh.slice(4, 6), 16) || 0
      const terang = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      const warnaTeks = terang > 0.55 ? '#1a1a1a' : '#ffffff'

      const muat = Math.max(1, Math.floor((node.h - pad * 2) / tinggiBaris))

      return (
        <g transform={transform} opacity={node.opacity}>
          <rect
            x={node.x} y={node.y} width={node.w} height={node.h}
            rx={node.radius || 6}
            fill={node.fill}
            stroke={node.stroke}
            strokeWidth={node.strokeWidth}
          />
          <text
            x={rata === 'center' ? cx : rata === 'right' ? node.x + node.w - pad : node.x + pad}
            y={node.y + pad + ukuranHuruf}
            fill={warnaTeks}
            textAnchor={anchor}
            style={{ font: `${fw} ${ukuranHuruf}px ${ff}` }}
          >
            {baris.slice(0, muat).map((t, i) => (
              <tspan
                key={i}
                x={rata === 'center' ? cx : rata === 'right' ? node.x + node.w - pad : node.x + pad}
                dy={i === 0 ? 0 : tinggiBaris}
              >
                {i === muat - 1 && baris.length > muat ? `${t.slice(0, Math.max(0, maksHuruf - 1))}…` : t}
              </tspan>
            ))}
          </text>
        </g>
      )
    }

    case 'text':
      return (
        <text
          x={rata === 'center' ? cx : rata === 'right' ? node.x + node.w : node.x}
          y={node.y + node.h}
          transform={transform}
          fill={node.fill}
          opacity={node.opacity}
          textAnchor={anchor}
          style={{ font: `${fw} ${fs}px ${ff}` }}
        >
          {node.text ?? ''}
        </text>
      )

    case 'image':
      // Saat assetUrl diberikan, gambar dirender langsung tanpa
      // pengambilan async. Export memerlukan ini karena
      // renderToStaticMarkup tidak menjalankan efek.
      return assetUrl ? (
        node.crop ? (
          <GambarTerpotong node={node} url={assetUrl} transform={transform} />
        ) : (
          <image
            href={assetUrl}
            x={node.x} y={node.y} width={node.w} height={node.h}
            transform={transform} opacity={node.opacity}
            preserveAspectRatio="xMidYMid slice"
          />
        )
      ) : (
        <ImageShape node={node} transform={transform} />
      )

    case 'group':
      // Group tidak menggambar apa pun; anaknya yang digambar.
      return null
  }
}
