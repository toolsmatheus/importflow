# Como contribuir — ImportFlow

Guia curto para subir o projeto e saber **onde editar** cada coisa.

## Setup local (primeira vez)

Pré-requisito: **Node.js 20+**.

```bash
# na raiz do repo
npm run install:all
copy .env.example .env   # Windows; ou cp .env.example .env
```

Dois terminais:

```bash
npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:5173  (proxy /api → 3001)
```

Cliente / produção local (um processo só):

```bat
start.bat
```

Abre `http://localhost:3001` (API + frontend buildado).

## Comandos úteis

| Comando | O que faz |
|---------|-----------|
| `npm run test` | Testes Vitest (backend) |
| `npm run lint` | Oxlint (frontend) |
| `npm run build` | Build front + back |
| `scripts\pack-client.ps1` | Zip leve para enviar ao cliente |

## Mapa mental — “quero mudar X”

| Quero… | Vá em… |
|--------|--------|
| Nova regra de validação CSV | `backend/src/services/validation/` (+ teste em `productValidationService.test.ts`) |
| Lista de controle / enum TMS | `backend/src/services/listaControlado.ts` |
| Payload do produto no TMS | `backend/src/services/productTmsMapper.ts` |
| Lógica HTTP TMS (auth, bulk) | `backend/src/services/tms/` |
| Job de envio (lotes, skip) | `backend/src/services/sendJobService.ts` + `send/` |
| Endpoint HTTP | `backend/src/routes/` + `controllers/` |
| Colunas do modelo CSV | `backend/src/schemas/product.schema.ts` |
| Tela do wizard / erros / envio | `frontend/src/components/wizard/` + `pages/ProductImportPage.tsx` |
| Estado do wizard | `frontend/src/hooks/useImportWizard.tsx` |
| Chamadas à API no browser | `frontend/src/services/` |
| Opcionais (fornecedor/estoque/…) | `optional*JobService.ts` + `components/optional/OptionalImportPanel.tsx` |
| Índices CMED/DCB/Portaria | `data/reference/` + `scripts/*.py` |

Documentação de regras (com exemplos): [VALIDACOES.md](VALIDACOES.md).  
Arquitetura e fluxo de dados: [ARCHITECTURE.md](ARCHITECTURE.md).  
Para agentes de IA: [AGENTS.md](AGENTS.md).

## Convenções

- Não criar pastas “vazias por padrão” (`database/`, `jobs/`, `middleware/`). Jobs ficam em `services/`.
- Não inventar rotas de Favorecidos/Financeiro — não existem neste repo.
- Mensagens ao usuário em **português**; identificadores de código em **inglês**.
- Backend ESM: imports com sufixo `.js`.
- Preferir teste unitário ao mudar validação ou mapper.

## TMS local

O envio real precisa do ToolsPharma (padrão `http://localhost:2001`). Sem TMS, ainda dá para validar CSV e exercitar a UI; probes/benchmarks em `backend/scripts/` (ver README dessa pasta).

## Higiene local

Ignorados pelo git (não commit): `node_modules/`, `dist/`, `.runtime/`, `dist-client/`, `*.log`, `.env`.  
Se aparecer `temp-start-bat.log` na raiz após testar o `.bat`, pode apagar.
