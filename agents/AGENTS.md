# AGENTS.md — ImportFlow

Instruções para humanos e agentes de IA que alteram este repositório.

## O que é este projeto

Monorepo de **importação CSV → ToolsPharma (TMS)**. Não é um CRUD de produtos: o fluxo é validar e enviar em lotes.

Docs de arquitetura (padrão ToolsPharma): esta pasta ([README.md](README.md)).  
Docs de produto: [../README.md](../README.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [VALIDACOES.md](VALIDACOES.md)

## Arquitetura obrigatória

Regras detalhadas em `architecture-*.md` (nesta pasta). Adaptação ImportFlow (sem SQL próprio):

```
backend/src/
  controller/     # HTTP → chama service → devolve DTO
  services/       # regra de negócio + jobs in-memory
    envio/        # helpers do job de envio
    validacao/    # regras de validação de produto
    tms/          # integração HTTP com o TMS (papel de “repository” externo)
  models/         # tipos/enums/constantes puros (sem Fastify/fetch)
  dto/            # contratos da API (*Dto)
  routes/         # registro Fastify
  utils/          # helpers compartilhados (ICMS, formatos)
  schemas/        # headers CSV / Zod de parse

frontend/src/
  api/            # única camada que fala HTTP com o backend
  features/       # um domínio por pasta (produtos, opcionais, configuracoes)
  components/     # design system ToolsPharma (Button, Sidebar, Card, …)
  layouts/        # shell com Sidebar
```

Fluxo backend: `controller → services → tms` (`services/tms/`).  
`models/` e `dto/` podem ser importados por todas as camadas e pelo frontend (`@models`, `@dto`).

### Não inventar

- Pastas vazias `database/`, `jobs/`, `middleware/` (sem SQL/sessão neste app).
- Rotas Favorecidos / Financeiro.
- 5º job opcional “Barras+” (barras extras = `codigoadicional` no CSV de produtos).
- Simular lotes na UI de produtos (`live` no wizard).
- HTTP Anvisa em runtime (índices offline em `data/reference/`).
- ORM / DI / repositories SQL genéricos.
- `fetch` direto em componentes React — só via `frontend/src/api/`.
- Redeclarar DTOs no frontend — importar de `@dto` / `@models`.

## Onde mexer

| Mudança | Local |
|---------|--------|
| Endpoint HTTP | `backend/src/controller/` + `routes/` |
| Regra de validação | `backend/src/services/validacao/` |
| Contrato API (tipos) | `backend/src/dto/`, `backend/src/models/` |
| Enum lista controlado TMS | `listaControlado` / models |
| Payload produto TMS | mapper em `services/` |
| HTTP TMS | `backend/src/services/tms/` |
| Job envio produtos | `envio.service` + `services/envio/` |
| Jobs opcionais | `opcional*.service` + runtime |
| Chamada HTTP no front | `frontend/src/api/` |
| UI produtos / wizard | `frontend/src/features/produtos/` |
| UI opcionais | `frontend/src/features/opcionais/` |
| Design system | `frontend/src/components/` |
| Tabela ICMS por UF | **só** `backend/src/utils/icmsByUf.ts` (front via `@importflow/icms`) |

## Convenções

- Identificadores de código em **português** (camelCase/PascalCase); mensagens de usuário em português.
- Arquivos de camada: `<entidade>.<camada>.ts` (ex.: `produto.controller.ts`, `envio.service.ts`).
- **Manter:** nomes TMS (`insertProduto`, `ImportarListaProdutos`, `AliquotaICMS`, `/tms/xdata/...`) e paths da API ImportFlow (`/api/products`, `/api/opcionais`).
- Backend ESM: imports com sufixo `.js`.
- Preferir teste Vitest em `backend/tests/` ao mudar validação, mapper ou ICMS.
- Não commit de `.env`, `node_modules/`, `dist/`, `.runtime/`, segredos.
- Commit/push só quando o usuário pedir.

## Cliente Windows

`start.bat` + `scripts/ensure-node.ps1` / `pack-client.ps1`. Não quebrar o one-click ao refatorar scripts da raiz.
