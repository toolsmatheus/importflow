/**
 * Benchmark: ProdutoService/insert (1 a 1) vs ImportacaoProdutoService/ImportarListaProdutos
 * Uso: npx tsx scripts/benchmark-product-import.ts [--sizes=10,25,50,100]
 */
import {
  fetchProductLookupCatalogs,
  fetchServerIdentification,
  getTmsAuth,
  insertProduct,
} from '../src/services/tmsService.js'
import { mapCsvRowToProductPayload } from '../src/services/productTmsMapper.js'

const BASE = process.env.TMS_BASE_URL ?? 'http://localhost:2001'
const RUN_ID = Number(process.env.BENCH_RUN_ID ?? Date.now() % 1_000_000)

const args = process.argv.slice(2)
const sizesArg = args.find((a) => a.startsWith('--sizes='))
const SIZES = sizesArg
  ? sizesArg
      .split('=')[1]
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => n > 0)
  : [10, 25, 50, 100]

interface BenchResult {
  approach: string
  count: number
  elapsedMs: number
  msPerProduct: number
  requests: number
  httpOk: number
  httpFail: number
  businessOk?: number
  businessFail?: number
  sampleResponse?: string
}

function codigoBench(block: number, index: number): string {
  return String(8_800_000 + block * 10_000 + index)
}

function eanBench(block: number, index: number): string {
  const digits = `789${String(RUN_ID + block).padStart(5, '0')}${String(index).padStart(4, '0')}`.slice(
    0,
    12
  )
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = Number(digits[11 - i])
    sum += i % 2 === 0 ? d * 3 : d
  }
  const check = (10 - (sum % 10)) % 10
  return digits + check
}

function buildRow(block: number, index: number, grupoMigracao: string): Record<string, string> {
  return {
    codigo: codigoBench(block, index),
    nome: `BENCH ${RUN_ID} B${block} I${index}`,
    codigogrupo: grupoMigracao,
    custo: '10,00',
    markup: '50,00',
    venda: '15,00',
    fator: '1',
    listapiscofins: 'NEUTRA',
    aliquota: '20',
    ncm: '30049099',
    cstpiscofins: '01',
    codigobarras: eanBench(block, index),
    st: 'N',
    isento: 'N',
    ativo: 'A',
  }
}

function buildDirectPayload(
  block: number,
  index: number,
  idFilial: number,
  refs: { grupoId: number; aliquotaId: number; unidadeId: number; cfopId: number }
): Record<string, unknown> {
  const codigo = Number(codigoBench(block, index))
  return {
    '@xdata.type': 'XData.Default.Produto',
    idFilial,
    nome: `BENCH ${RUN_ID} B${block} I${index}`,
    valorCusto: 10,
    ultimoValorCusto: 10,
    valorvenda: 15,
    ultimoValorVenda: 15,
    margemLucro: 50,
    fatordecompra: 1,
    codigo_migracao: codigo,
    codigoBarras: eanBench(block, index),
    ncm: '30049099',
    ativo: true,
    monofasico: false,
    atualizarestoque: true,
    atualizarpreco: true,
    permitirdescontovenda: true,
    origemmercadoria: 'omNacional',
    apresentacao: 'taCapCompDrag',
    tipopreco: 'tpLiberado',
    tipoitemsped: 'tisMercadoriaRevenda',
    tipoListaPisCofins: 'tlListaNeutra',
    listaControlado: 'tlNenhuma',
    listaControladoAdendo: 'tlNenhuma',
    cstpis: '01',
    cstcofins: '01',
    csticms: 'cic102',
    csticmsnormal: 'cic00',
    'grupo@xdata.ref': `GrupoProdutoDrogaria(${refs.grupoId})`,
    'aliquotaicms@xdata.ref': `AliquotaICMS(${refs.aliquotaId})`,
    'unidadeEstoque@xdata.ref': `Unidade(${refs.unidadeId})`,
    'cfopvenda@xdata.ref': `CFOP(${refs.cfopId})`,
  }
}

function buildPayloadsDirect(
  block: number,
  size: number,
  idFilial: number,
  refs: { grupoId: number; aliquotaId: number; unidadeId: number; cfopId: number }
) {
  return Array.from({ length: size }, (_, i) => buildDirectPayload(block, i + 1, idFilial, refs))
}

function parseListaResponse(text: string, count: number): { businessOk: number; businessFail: number } {
  let payload: unknown = text
  try {
    payload = JSON.parse(text)
  } catch {
    /* raw */
  }
  const message =
    typeof payload === 'object' && payload && 'value' in payload
      ? String((payload as { value: unknown }).value ?? '')
      : String(payload ?? '')

  if (!message.trim()) return { businessOk: count, businessFail: 0 }
  const errors = (message.match(/Erro ao salvar/gi) ?? []).length
  if (errors === 0 && !/erro/i.test(message)) return { businessOk: count, businessFail: 0 }
  if (errors > 0) return { businessOk: Math.max(0, count - errors), businessFail: errors }
  return { businessOk: 0, businessFail: count }
}

async function importarListaProdutos(payloads: Record<string, unknown>[]) {
  const auth = await getTmsAuth(BASE)
  const url = `${BASE.replace(/\/$/, '')}/tms/xdata/ImportacaoProdutoService/ImportarListaProdutos`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: auth.authorization,
    },
    body: JSON.stringify({ Produtos: payloads, ImportarJaExistente: false }),
  })
  const text = await response.text()
  return { ok: response.ok, status: response.status, text }
}

async function benchSequential(payloads: Record<string, unknown>[]): Promise<BenchResult> {
  const start = performance.now()
  let httpOk = 0
  let httpFail = 0
  let sampleResponse: string | undefined

  for (const payload of payloads) {
    const result = await insertProduct(payload, BASE)
    if (result.ok) httpOk++
    else {
      httpFail++
      if (!sampleResponse) sampleResponse = result.message?.slice(0, 240)
    }
  }

  const elapsedMs = performance.now() - start
  return {
    approach: 'ProdutoService/insert (sequencial, atual)',
    count: payloads.length,
    elapsedMs,
    msPerProduct: elapsedMs / payloads.length,
    requests: payloads.length,
    httpOk,
    httpFail,
    businessOk: httpOk,
    businessFail: httpFail,
    sampleResponse,
  }
}

async function benchLista(
  payloads: Record<string, unknown>[],
  label: string
): Promise<BenchResult> {
  const start = performance.now()
  const res = await importarListaProdutos(payloads)
  const elapsedMs = performance.now() - start
  const parsed = parseListaResponse(res.text, payloads.length)

  return {
    approach: label,
    count: payloads.length,
    elapsedMs,
    msPerProduct: elapsedMs / payloads.length,
    requests: 1,
    httpOk: res.ok ? 1 : 0,
    httpFail: res.ok ? 0 : 1,
    businessOk: parsed.businessOk,
    businessFail: parsed.businessFail,
    sampleResponse: res.text.slice(0, 240),
  }
}

async function benchConcurrentLikeImportFlow(
  payloads: Record<string, unknown>[],
  batchSize: number,
  concurrency: number
): Promise<BenchResult> {
  const start = performance.now()
  let httpOk = 0
  let httpFail = 0
  let sampleResponse: string | undefined
  let requests = 0

  const chunks: Record<string, unknown>[][] = []
  for (let i = 0; i < payloads.length; i += batchSize) {
    chunks.push(payloads.slice(i, i + batchSize))
  }

  let cursor = 0
  async function worker() {
    while (cursor < chunks.length) {
      const batch = chunks[cursor++]
      await Promise.all(
        batch.map(async (payload) => {
          requests++
          const result = await insertProduct(payload, BASE)
          if (result.ok) httpOk++
          else {
            httpFail++
            if (!sampleResponse) sampleResponse = result.message?.slice(0, 240)
          }
        })
      )
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  const elapsedMs = performance.now() - start

  return {
    approach: `ProdutoService/insert (lote ${batchSize}, concorrência ${concurrency} — padrão UI)`,
    count: payloads.length,
    elapsedMs,
    msPerProduct: elapsedMs / payloads.length,
    requests,
    httpOk,
    httpFail,
    businessOk: httpOk,
    businessFail: httpFail,
    sampleResponse,
  }
}

async function main() {
  console.log(`TMS: ${BASE}`)
  console.log(`RUN_ID: ${RUN_ID}`)
  console.log(`Tamanhos: ${SIZES.join(', ')}`)

  const { idFilial } = await fetchServerIdentification(BASE)
  const catalogs = await fetchProductLookupCatalogs(BASE)
  const refs = {
    grupoId: 11,
    aliquotaId: catalogs.aliquotaByPercent.get(17) ?? 200,
    unidadeId: catalogs.unidadeUnId || 600,
    cfopId: catalogs.cfopByCode.get('5102') ?? 2300,
  }

  const allResults: BenchResult[] = []
  let block = 0

  for (const size of SIZES) {
    block++
    console.log(`\n=== N=${size} (bloco ${block}) ===`)
    const payloads = buildPayloadsDirect(block, size, idFilial, refs)

    const seq = await benchSequential(payloads)
    allResults.push(seq)
    console.log(
      `${seq.approach}: ${seq.elapsedMs.toFixed(0)}ms total | ${seq.msPerProduct.toFixed(1)}ms/prod | ${seq.requests} req | HTTP ok=${seq.httpOk} fail=${seq.httpFail}`
    )

    const payloads2 = buildPayloadsDirect(block + 100, size, idFilial, refs)
    const lista = await benchLista(payloads2, 'ImportarListaProdutos (1 requisição)')
    allResults.push(lista)
    console.log(
      `${lista.approach}: ${lista.elapsedMs.toFixed(0)}ms total | ${lista.msPerProduct.toFixed(1)}ms/prod | ${lista.requests} req | HTTP ok=${lista.httpOk} | negócio ok=${lista.businessOk} fail=${lista.businessFail}`
    )

    const payloads3 = buildPayloadsDirect(block + 200, size, idFilial, refs)
    const concurrent = await benchConcurrentLikeImportFlow(payloads3, 100, 2)
    allResults.push(concurrent)
    console.log(
      `${concurrent.approach}: ${concurrent.elapsedMs.toFixed(0)}ms total | ${concurrent.msPerProduct.toFixed(1)}ms/prod | ${concurrent.requests} req`
    )

    if (size >= 50) {
      const payloads4 = buildPayloadsDirect(block + 300, size, idFilial, refs)
      const CHUNK = 50
      const start = performance.now()
      let requests = 0
      let businessOk = 0
      let businessFail = 0
      let sampleResponse: string | undefined
      for (let i = 0; i < payloads4.length; i += CHUNK) {
        requests++
        const res = await importarListaProdutos(payloads4.slice(i, i + CHUNK))
        const parsed = parseListaResponse(res.text, Math.min(CHUNK, payloads4.length - i))
        businessOk += parsed.businessOk
        businessFail += parsed.businessFail
        if (!sampleResponse) sampleResponse = res.text.slice(0, 240)
      }
      const elapsedMs = performance.now() - start
      allResults.push({
        approach: `ImportarListaProdutos (chunks de ${CHUNK})`,
        count: size,
        elapsedMs,
        msPerProduct: elapsedMs / size,
        requests,
        httpOk: requests,
        httpFail: 0,
        businessOk,
        businessFail,
        sampleResponse,
      })
      console.log(
        `ImportarListaProdutos chunks: ${elapsedMs.toFixed(0)}ms | ${requests} req | negócio ok=${businessOk} fail=${businessFail}`
      )
    }
  }

  const summary = {
    runId: RUN_ID,
    tmsBaseUrl: BASE,
    sizes: SIZES,
    note: 'Comparar elapsedMs, msPerProduct e requests. ImportarListaProdutos usa 1 POST por lote.',
    results: allResults,
  }

  console.log('\n=== JSON ===')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
