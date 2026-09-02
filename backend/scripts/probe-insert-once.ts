import { fetchProductLookupCatalogs, getTmsAuth, insertProduct, fetchServerIdentification } from '../src/services/tmsService.js'
import { mapCsvRowToProductPayload } from '../src/services/productTmsMapper.js'

const BASE = 'http://localhost:2001'
const { idFilial } = await fetchServerIdentification(BASE)
const catalogs = await fetchProductLookupCatalogs(BASE)
const grupo = [...catalogs.grupoByMigracao.keys()].find((k) => k && k !== '0') ?? ''
console.log('grupo migracao sample', grupo)
console.log('cfop 5102 id', catalogs.cfopByCode.get('5102'))
console.log('cfop 5405 id', catalogs.cfopByCode.get('5405'))
console.log('unidade UN id', catalogs.unidadeUnId)
console.log('aliquota 20 id', catalogs.aliquotaByPercent.get(20))

const ts = Date.now()
const row = {
  codigo: String(881000 + (ts % 10000)),
  nome: `PROBE ${ts}`,
  codigogrupo: grupo,
  custo: '10,00',
  markup: '50,00',
  venda: '15,00',
  fator: '1',
  listapiscofins: 'NEUTRA',
  aliquota: '20',
  ncm: '30049099',
  cstpiscofins: '01',
  codigobarras: `789${String(ts).slice(-10)}`,
  st: 'N',
  isento: 'N',
  ativo: 'A',
}
const mapped = mapCsvRowToProductPayload(row, idFilial, catalogs)
if (!mapped.ok) {
  console.log('map fail', mapped.message)
  process.exit(1)
}
console.log('cfop ref', mapped.payload['cfopvenda@xdata.ref'])
const ins = await insertProduct(mapped.payload, BASE)
console.log('insert ok', ins.ok, ins.message?.slice(0, 400))
