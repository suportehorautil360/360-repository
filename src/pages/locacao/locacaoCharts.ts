import type { DashboardGraficos, TopOperador } from '../../lib/hu360/types'

function setupCanvas(canvas: HTMLCanvasElement): {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
} | null {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

export function locDesenharBarrasVerticais(
  canvas: HTMLCanvasElement | null,
  labels: string[],
  valores: number[],
  opts?: { formatY?: 'money' | 'int' },
): void {
  if (!canvas || !labels?.length || !valores?.length) return
  const pack = setupCanvas(canvas)
  if (!pack) return
  const { ctx, w, h } = pack
  const formatY = opts?.formatY ?? 'int'
  const padL = formatY === 'money' ? 56 : 36
  const padR = 12
  const padT = 10
  const padB = 38
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const max = Math.max(...valores, 1) * 1.08
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1
  for (let g = 0; g <= 4; g++) {
    const gy = padT + (innerH * g) / 4
    ctx.beginPath()
    ctx.moveTo(padL, gy)
    ctx.lineTo(padL + innerW, gy)
    ctx.stroke()
  }
  const n = valores.length
  const gap = innerW * 0.12
  const barW = (innerW - gap * (n + 1)) / n
  const x0 = padL + gap
  const fmt =
    formatY === 'money'
      ? (v: number) => {
          if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
          if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
          return String(Math.round(v))
        }
      : (v: number) => String(Math.round(v))
  ctx.fillStyle = '#64748b'
  ctx.font = '11px system-ui,Segoe UI,sans-serif'
  ctx.textAlign = 'right'
  for (let gi = 0; gi <= 4; gi++) {
    const val = max * (1 - gi / 4)
    ctx.fillText(fmt(val), padL - 6, padT + (innerH * gi) / 4 + 4)
  }
  for (let i = 0; i < n; i++) {
    const v = valores[i] ?? 0
    const bh = innerH * (v / max)
    const bx = x0 + i * (barW + gap)
    const by = padT + innerH - bh
    const grad = ctx.createLinearGradient(0, by, 0, by + bh)
    grad.addColorStop(0, '#fb923c')
    grad.addColorStop(1, '#ea580c')
    ctx.fillStyle = grad
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bx, by, barW, bh, [4, 4, 0, 0])
    } else {
      ctx.rect(bx, by, barW, bh)
    }
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '11px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(labels[i] || '', bx + barW / 2, h - 12)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px system-ui,Segoe UI,sans-serif'
    if (formatY === 'money') {
      ctx.fillText(
        `${(v / 1000).toFixed(0)}k`,
        bx + barW / 2,
        by > 18 ? by - 4 : by + bh + 12,
      )
    } else {
      ctx.fillText(String(v), bx + barW / 2, by > 18 ? by - 4 : by + bh + 12)
    }
  }
}

export function locDesenharBarrasHorizOperadores(
  canvas: HTMLCanvasElement | null,
  lista: TopOperador[],
): void {
  if (!canvas || !lista?.length) return
  const pack = setupCanvas(canvas)
  if (!pack) return
  const { ctx, w, h } = pack
  const padL = 132
  const padR = 44
  const padT = 8
  const padB = 8
  const rowH = (h - padT - padB) / lista.length
  const innerW = w - padL - padR
  let maxB = Math.max(...lista.map((o) => o.bemFeitos || 0), 1)
  maxB = Math.max(maxB, 1)
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, w, h)
  lista.forEach((op, i) => {
    const y = padT + i * rowH
    let nome = op.nome || '—'
    if (nome.length > 22) nome = `${nome.substring(0, 20)}…`
    const q = op.bemFeitos || 0
    const bw = innerW * (q / maxB)
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(padL, y + 4, innerW, rowH - 8)
    const grad = ctx.createLinearGradient(padL, 0, padL + bw, 0)
    grad.addColorStop(0, '#fb923c')
    grad.addColorStop(1, '#ea580c')
    ctx.fillStyle = grad
    ctx.fillRect(padL, y + 5, bw, rowH - 10)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '12px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(nome, 8, y + rowH / 2)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px system-ui,Segoe UI,sans-serif'
    ctx.fillText(op.indice || '', padL + bw + 6, y + rowH / 2 - 6)
    ctx.fillStyle = '#f1f5f9'
    ctx.font = 'bold 12px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(q), w - 8, y + rowH / 2)
  })
}

export function locDesenharDashboardGraficos(
  canvasChecklists: HTMLCanvasElement | null,
  canvasOperadores: HTMLCanvasElement | null,
  dg: DashboardGraficos | undefined,
): void {
  if (!dg) return
  locDesenharBarrasVerticais(
    canvasChecklists,
    dg.checklistLabels ?? [],
    dg.checklistRecebidos ?? [],
    { formatY: 'int' },
  )
  locDesenharBarrasHorizOperadores(canvasOperadores, dg.topOperadores ?? [])
}
