import { getTmsAuth } from '../src/services/tmsService.js'

const BASE = 'http://localhost:2001'
const auth = await getTmsAuth(BASE)
const codes = [9900001, 13900001, 13900500, 18900001, 28900001, 28902000]
for (const codigo of codes) {
  const filter = encodeURIComponent(`codigo_migracao eq ${codigo}`)
  const r = await fetch(`${BASE}/tms/xdata/Produto?$filter=${filter}&$top=1`, {
    headers: { Accept: 'application/json', Authorization: auth.authorization },
  })
  const data = (await r.json()) as { value?: Record<string, unknown>[] }
  const row = data.value?.[0]
  console.log(
    codigo,
    row
      ? {
          id: row.id,
          nome: row.nome,
          valorvenda: row.valorvenda,
          codigoBarras: row.codigoBarras,
        }
      : 'NOT FOUND'
  )
}
