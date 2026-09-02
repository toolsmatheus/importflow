import { fetchServerIdentification, getTmsAuth } from '../src/services/tmsService.js'

const BASE = 'http://localhost:2001'
const RUN = Date.now() % 100000

function payload(i: number, block: number) {
  const codigo = 8_900_000 + block * 10000 + i
  const digits = `789${String(RUN + block).padStart(5, '0')}${String(i).padStart(4, '0')}`.slice(0, 12)
  let sum = 0
  for (let j = 0; j < 12; j++) sum += j % 2 === 0 ? Number(digits[11 - j]) * 3 : Number(digits[11 - j])
  const ean = digits + ((10 - (sum % 10)) % 10)
  return {
    '@xdata.type': 'XData.Default.Produto',
    idFilial: 1,
    nome: `LISTA ${RUN} ${i}`,
    valorCusto: 10,
    ultimoValorCusto: 10,
    valorvenda: 15,
    ultimoValorVenda: 15,
    margemLucro: 50,
    codigo_migracao: codigo,
    codigoBarras: ean,
    ncm: '30049099',
    ativo: true,
    tipoListaPisCofins: 'tlListaNeutra',
    'grupo@xdata.ref': 'GrupoProdutoDrogaria(11)',
    'aliquotaicms@xdata.ref': 'AliquotaICMS(200)',
    'unidadeEstoque@xdata.ref': 'Unidade(600)',
    'cfopvenda@xdata.ref': 'CFOP(2300)',
  }
}

const sizes = [100, 500, 1000, 2000]
const { idFilial } = await fetchServerIdentification(BASE)
const auth = await getTmsAuth(BASE)

for (const n of sizes) {
  const items = Array.from({ length: n }, (_, i) => payload(i + 1, n))
  const body = JSON.stringify({ Produtos: items, ImportarJaExistente: false })
  const mb = (body.length / 1024 / 1024).toFixed(2)
  const t0 = performance.now()
  const r = await fetch(`${BASE}/tms/xdata/ImportacaoProdutoService/ImportarListaProdutos`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: auth.authorization,
    },
    body,
  })
  const ms = performance.now() - t0
  const text = await r.text()
  const errors = (text.match(/Erro ao salvar/gi) ?? []).length
  console.log(
    JSON.stringify({
      n,
      payloadMb: mb,
      ms: Math.round(ms),
      msPerProduct: +(ms / n).toFixed(2),
      httpStatus: r.status,
      httpOk: r.ok,
      errorLines: errors,
      preview: text.slice(0, 180),
    })
  )
}
