/**
 * Pipeline de extração de texto e OCR para o credenciamento de oficinas.
 *
 * Segue o que o hub admin original (`processarExtracaoCredApósAnexos`) fazia
 * em JS puro, agora usando `pdfjs-dist` e `tesseract.js` carregados de forma
 * preguiçosa (dynamic import) para não pesar o bundle inicial.
 */

export const CRED_OCR_MAX_PAGES_POR_PDF = 5
export const CRED_OCR_MAX_PDFS_SEM_CNPJ = 3

export interface CredOcrProgressInfo {
  pct: number
  rotulo?: string
}

export interface CredOcrResultado {
  cnpj: string
  razaoSocial: string
  status: string
  usouOcr: boolean
}

export interface CredOcrParams {
  files: FileList | File[]
  onProgresso?: (info: CredOcrProgressInfo) => void
}

export function validarCnpjDigitos(d14: string): boolean {
  if (!/^\d{14}$/.test(d14) || /^(\d)\1{13}$/.test(d14)) return false
  const d = d14.split('').map(Number)
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let s = 0
  for (let i = 0; i < 12; i++) s += d[i] * w1[i]
  let r = s % 11 < 2 ? 0 : 11 - (s % 11)
  if (r !== d[12]) return false
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  s = 0
  for (let i = 0; i < 13; i++) s += d[i] * w2[i]
  r = s % 11 < 2 ? 0 : 11 - (s % 11)
  return r === d[13]
}

export function formatarCnpjDigitos(d14: string): string {
  return d14.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function extrairCnpjsValidosDoTexto(texto: string): string[] {
  if (!texto) return []
  const vistos = new Map<string, string>()
  const reM = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g
  let m: RegExpExecArray | null
  while ((m = reM.exec(texto)) !== null) {
    const dig = m[0].replace(/\D/g, '')
    if (validarCnpjDigitos(dig)) vistos.set(dig, formatarCnpjDigitos(dig))
  }
  const soNum = texto.replace(/\D/g, '')
  for (let p = 0; p + 14 <= soNum.length; p++) {
    const sl = soNum.slice(p, p + 14)
    if (validarCnpjDigitos(sl)) vistos.set(sl, formatarCnpjDigitos(sl))
  }
  return Array.from(vistos.values())
}

export function escolherCnpjPreferido(texto: string, lista: string[]): string {
  if (!lista || !lista.length) return ''
  const lower = texto.toLowerCase()
  const pos = lower.search(/\bcnpj\b/)
  if (pos >= 0) {
    const trecho = texto.slice(Math.max(0, pos - 30), pos + 200)
    for (let k = 0; k < lista.length; k++) {
      const d = lista[k].replace(/\D/g, '')
      if (trecho.indexOf(lista[k]) >= 0 || trecho.indexOf(d) >= 0) {
        return lista[k]
      }
    }
  }
  return lista[0]
}

export function tentarRazaoSocialNoTexto(texto: string): string {
  if (!texto) return ''
  const m2 = texto.match(
    /(?:raz[aã]o\s+social|nome\s+empresarial)\s*:\s*([^\n\r]{4,220})/i,
  )
  if (m2 && m2[1]) return m2[1].trim().replace(/\s+/g, ' ')
  return ''
}

type PdfJsModule = typeof import('pdfjs-dist')
type TesseractModule = typeof import('tesseract.js')

let pdfjsPromise: Promise<PdfJsModule> | null = null
async function carregarPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url'))
        .default
      mod.GlobalWorkerOptions.workerSrc = workerUrl
      return mod
    })()
  }
  return pdfjsPromise
}

let tesseractPromise: Promise<TesseractModule> | null = null
async function carregarTesseract(): Promise<TesseractModule> {
  if (!tesseractPromise) {
    tesseractPromise = import('tesseract.js')
  }
  return tesseractPromise
}

async function extrairTextoDoPdf(
  arquivo: File,
  pdfjsLib: PdfJsModule,
): Promise<string> {
  const buf = await arquivo.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let full = ''
  for (let pg = 1; pg <= pdf.numPages; pg++) {
    const page = await pdf.getPage(pg)
    const tc = await page.getTextContent()
    full +=
      tc.items
        .map((it) =>
          'str' in it && typeof (it as { str: string }).str === 'string'
            ? (it as { str: string }).str
            : '',
        )
        .join(' ') + '\n'
  }
  return full
}

interface OcrWorker {
  recognize: (img: unknown) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}

async function ocrPaginasPdfComWorker(
  worker: OcrWorker,
  arquivoPdf: File,
  pdfjsLib: PdfJsModule,
  maxPag: number,
  onPaginaFeita: (num: number, tot: number) => void,
): Promise<string> {
  const buf = await arquivoPdf.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const lim = Math.min(pdf.numPages, maxPag)
  let textoAcum = ''
  for (let pg = 1; pg <= lim; pg++) {
    const page = await pdf.getPage(pg)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    const r = await worker.recognize(canvas)
    textoAcum += (r?.data?.text ?? '') + '\n'
    onPaginaFeita(pg, lim)
  }
  return textoAcum
}

/**
 * Lê os anexos selecionados (PDFs e imagens), tenta extrair texto direto dos
 * PDFs e, quando preciso, faz OCR em português via Tesseract.
 *
 * Devolve o CNPJ formatado (se algum válido foi encontrado), a razão social
 * detectada e o texto de status pronto para exibição.
 */
export async function processarExtracaoCredAposAnexos({
  files,
  onProgresso,
}: CredOcrParams): Promise<CredOcrResultado> {
  const todos = Array.from(files)
  const pdfs = todos.filter(
    (f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf',
  )
  const imgs = todos.filter(
    (f) =>
      /\.(jpe?g|png|webp)$/i.test(f.name) ||
      (f.type && f.type.indexOf('image/') === 0),
  )

  const fail = (status: string): CredOcrResultado => ({
    cnpj: '',
    razaoSocial: '',
    status,
    usouOcr: false,
  })

  if (!todos.length) return fail('')
  if (!pdfs.length && !imgs.length) {
    return fail(
      'Use PDF ou imagem (JPG, PNG, WebP) para extração automática.',
    )
  }

  let pdfjsLib: PdfJsModule
  try {
    onProgresso?.({ pct: 6, rotulo: 'Carregando leitor de PDF…' })
    pdfjsLib = await carregarPdfJs()
  } catch {
    return fail('Biblioteca de PDF não carregada (verifique a internet).')
  }

  const PDF_TEXTO_CURTO = 36
  let textoTodo = ''
  const pdfsParaOcr: File[] = []

  onProgresso?.({ pct: 8, rotulo: 'Lendo texto nativo dos PDFs…' })

  for (const arquivo of pdfs) {
    try {
      const t = await extrairTextoDoPdf(arquivo, pdfjsLib)
      const tt = t || ''
      textoTodo += tt + '\n'
      if (tt.replace(/\s/g, '').length < PDF_TEXTO_CURTO) {
        if (pdfsParaOcr.indexOf(arquivo) < 0) pdfsParaOcr.push(arquivo)
      }
    } catch {
      if (pdfsParaOcr.indexOf(arquivo) < 0) pdfsParaOcr.push(arquivo)
    }
  }

  onProgresso?.({ pct: 14, rotulo: 'Verificando CNPJ no texto extraído…' })
  const listaPre = extrairCnpjsValidosDoTexto(textoTodo)
  const jaTemCnpj = listaPre.length > 0

  let pdfsOcr = pdfsParaOcr
  if (!jaTemCnpj && pdfs.length) {
    for (let q = 0; q < pdfs.length && q < CRED_OCR_MAX_PDFS_SEM_CNPJ; q++) {
      if (pdfsOcr.indexOf(pdfs[q]) < 0) pdfsOcr.push(pdfs[q])
    }
  }
  if (jaTemCnpj) pdfsOcr = []

  const precisaWorker = imgs.length > 0 || pdfsOcr.length > 0

  function montarResultado(usouOcr: boolean, statusOverride?: string): CredOcrResultado {
    const lista = extrairCnpjsValidosDoTexto(textoTodo)
    const cnpj = escolherCnpjPreferido(textoTodo, lista)
    const razao = tentarRazaoSocialNoTexto(textoTodo)
    let status = statusOverride ?? ''
    if (!status) {
      if (cnpj) {
        status = usouOcr
          ? 'CNPJ encontrado (texto do PDF e/ou OCR). Confira os campos abaixo.'
          : 'CNPJ encontrado no texto do PDF. Confira os campos abaixo.'
      } else {
        status =
          'Nenhum CNPJ válido detectado — verifique a legibilidade do arquivo ou informe manualmente.'
      }
    }
    onProgresso?.({ pct: 100, rotulo: 'Concluído.' })
    return { cnpj, razaoSocial: razao, status, usouOcr }
  }

  if (!precisaWorker) {
    onProgresso?.({ pct: 90, rotulo: 'Finalizando…' })
    return montarResultado(false)
  }

  let TesseractLib: TesseractModule
  try {
    onProgresso?.({
      pct: 16,
      rotulo: 'Iniciando OCR em português (pode baixar idioma na 1ª vez)…',
    })
    TesseractLib = await carregarTesseract()
  } catch {
    return montarResultado(
      false,
      'OCR não disponível (sem conexão com a biblioteca). Usando só texto extraído do PDF.',
    )
  }

  // Pré-cálculo do total de passos pra barra de progresso ficar coerente.
  const contagens: number[] = []
  for (const pdfF of pdfsOcr) {
    try {
      const buf = await pdfF.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      contagens.push(Math.min(pdf.numPages, CRED_OCR_MAX_PAGES_POR_PDF))
    } catch {
      contagens.push(CRED_OCR_MAX_PAGES_POR_PDF)
    }
  }
  const paginasOcr = contagens.reduce((a, b) => a + b, 0)
  const totalPassos = imgs.length + paginasOcr
  let passoAtual = 0
  function avancarBarra(rotulo: string) {
    passoAtual++
    const pct = 16 + (passoAtual / Math.max(1, totalPassos)) * 78
    onProgresso?.({ pct: Math.min(97, pct), rotulo })
  }

  let worker: OcrWorker
  try {
    worker = (await TesseractLib.createWorker('por', 1, {
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          const base =
            16 + ((passoAtual + m.progress) / Math.max(1, totalPassos)) * 78
          onProgresso?.({
            pct: Math.min(97, base),
            rotulo: 'Reconhecendo texto…',
          })
        }
      },
    })) as unknown as OcrWorker
  } catch {
    return montarResultado(
      false,
      'OCR indisponível agora. Resultado obtido apenas a partir do texto extraído.',
    )
  }

  try {
    for (const imgFile of imgs) {
      const r = await worker.recognize(imgFile)
      textoTodo += (r?.data?.text ?? '') + '\n'
      avancarBarra('Imagem: ' + imgFile.name)
    }
    for (const pdfF of pdfsOcr) {
      const t = await ocrPaginasPdfComWorker(
        worker,
        pdfF,
        pdfjsLib,
        CRED_OCR_MAX_PAGES_POR_PDF,
        (num, tot) => avancarBarra(`PDF ${pdfF.name} — página ${num}/${tot}`),
      )
      textoTodo += (t || '') + '\n'
    }
  } catch {
    /* mantém o que já foi extraído */
  } finally {
    try {
      await worker.terminate()
    } catch {
      /* ignore */
    }
  }

  return montarResultado(true)
}
