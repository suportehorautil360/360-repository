export function esc(t: unknown): string {
  if (t == null || t === undefined) {
    return ''
  }
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

export function parseRealBr(txt: string | null | undefined): number {
  if (!txt) {
    return 0
  }
  let x = String(txt).replace(/R\$\s*/gi, '').trim()
  x = x.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(x)
  return Number.isNaN(n) ? 0 : n
}

export function formatRealBr(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseDataBr(s: string | null | undefined): Date | null {
  if (!s) {
    return null
  }
  const p = String(s).trim().split(/[/.-]/)
  if (p.length !== 3) {
    return null
  }
  let da: number
  let mo: number
  let y: number
  if (p[0].length === 4) {
    y = parseInt(p[0], 10)
    mo = parseInt(p[1], 10) - 1
    da = parseInt(p[2], 10)
  } else {
    da = parseInt(p[0], 10)
    mo = parseInt(p[1], 10) - 1
    y = parseInt(p[2], 10)
    if (y < 100) {
      y += 2000
    }
  }
  const d = new Date(y, mo, da)
  return Number.isNaN(d.getTime()) ? null : d
}

export function mesmoMes(d: Date | null, ano: number, mes: number): boolean {
  return !!d && d.getFullYear() === ano && d.getMonth() + 1 === mes
}
