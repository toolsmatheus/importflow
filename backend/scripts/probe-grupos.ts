import { obterAuthTms, buscarIdentificacaoServidor } from '../src/services/tms.service.js'

const BASE = 'http://localhost:2001'
const auth = await obterAuthTms(BASE)
const { idFilial } = await buscarIdentificacaoServidor(BASE)
for (const entity of ['AliquotaICMS', 'GrupoProdutoDrogaria']) {
  const r = await fetch(`${BASE}/tms/xdata/${entity}?$top=3`, {
    headers: { Accept: 'application/json', Authorization: auth.authorization },
  })
  console.log('\n', entity, await r.text())
}
