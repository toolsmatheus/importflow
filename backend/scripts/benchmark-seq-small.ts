import { insertProduct, fetchServerIdentification } from '../src/services/tmsService.js'

const BASE = 'http://localhost:2001'
const RUN = Date.now() % 100000
const { idFilial } = await fetchServerIdentification(BASE)

function payload(i: number) {
  const codigo = 8_700_000 + i
  return {
    '@xdata.type': 'XData.Default.Produto',
    idFilial,
    nome: `SEQ ${RUN} ${i}`,
    valorCusto: 10,
    ultimoValorCusto: 10,
    valorvenda: 15,
    ultimoValorVenda: 15,
    margemLucro: 50,
    codigo_migracao: codigo,
    codigoBarras: `789${String(RUN).padStart(5, '0')}${String(i).padStart(4, '0')}`.slice(0, 13),
    ncm: '30049099',
    ativo: true,
    tipoListaPisCofins: 'tlListaNeutra',
    'grupo@xdata.ref': 'GrupoProdutoDrogaria(11)',
    'aliquotaicms@xdata.ref': 'AliquotaICMS(200)',
    'unidadeEstoque@xdata.ref': 'Unidade(600)',
    'cfopvenda@xdata.ref': 'CFOP(2300)',
  }
}

const n = 5
const t0 = performance.now()
let ok = 0
for (let i = 1; i <= n; i++) {
  const r = await insertProduct(payload(i), BASE)
  if (r.ok) ok++
  else console.log('fail', i, r.message?.slice(0, 120))
}
console.log(JSON.stringify({ n, ms: Math.round(performance.now() - t0), msPerProduct: Math.round((performance.now() - t0) / n), ok }))
