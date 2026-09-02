import { getTmsAuth, fetchServerIdentification } from '../src/services/tmsService.js'

const BASE = 'http://localhost:2001'
const auth = await getTmsAuth(BASE)
const { idFilial } = await fetchServerIdentification(BASE)
for (const entity of ['AliquotaICMS', 'GrupoProdutoDrogaria']) {
  const r = await fetch(`${BASE}/tms/xdata/${entity}?$top=3`, {
    headers: { Accept: 'application/json', Authorization: auth.authorization },
  })
  console.log('\n', entity, await r.text())
}
