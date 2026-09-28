# ImportFlow — Arquitetura

Guia para onboarding: como o monorepo se organiza, como os dados fluem do CSV até o TMS, e onde encontrar cada responsabilidade.

- Instalação e endpoints: [README.md](README.md)
- Como contribuir / primeiro setup: [CONTRIBUTING.md](CONTRIBUTING.md)
- Regras de validação: [VALIDACOES.md](VALIDACOES.md)
- Scripts utilitários: [scripts/README.md](scripts/README.md)

---

## Visão geral

```
ImportFlow/
├── backend/          API Fastify (validação, jobs, integração TMS)
├── frontend/         Wizard React (produtos + opcionais)
├── data/             CSVs de exemplo + índices JSON (CMED, DCB, Portaria 344)
├── scripts/          Índices Anvisa (Python) + helpers de cliente (PowerShell)
├── backend/scripts/  Benchmarks/probes contra TMS local (dev only)
├── start.bat         Deploy one-click (build + serve :3001)
├── CONTRIBUTING.md   Setup local e “onde editar o quê”
└── .env.example      Variáveis de ambiente
```

**Produção / cliente:** o backend na porta `3001` serve o frontend buildado (`frontend/dist`) e expõe `/api/*`. O TMS (ToolsPharma) roda separado (padrão `:2001`).

---

## Backend

### Camadas

```
server.ts
  └── routes/            Registro Fastify (/api)
        └── controllers/ HTTP: parse request → service → JSON
              └── services/  Lógica de negócio + jobs in-memory
                    └── tms/   Integração HTTP com o TMS
```

Não há pastas `database/`, `jobs/` ou `middleware/` — jobs ficam em `services/` (`sendJobService`, `optional*JobService`).

| Camada | Pasta | Papel |
|--------|-------|-------|
| Rotas | `backend/src/routes/` | Agrupa endpoints por domínio |
| Controllers | `backend/src/controllers/` | Entrada HTTP, status, streaming NDJSON |
| Services | `backend/src/services/` | Validação, CSV, envio, índices locais |
| TMS | `backend/src/services/tms/` | Auth, OData, bulk insert, estoque, lotes |
| Schemas | `backend/src/schemas/` | Headers CSV, entidades auxiliares, Zod |
| Utils | `backend/src/utils/` | Formatos BR, ICMS por UF, detecção de CSV |

### Rotas principais

| Módulo | Prefixo | Responsabilidade |
|--------|---------|------------------|
| `health.routes.ts` | `/api/health` | Saúde da API |
| `csv.routes.ts` | `/api/csv` | Upload genérico de CSV (`fileId`) |
| `product.routes.ts` | `/api/products` | Wizard: templates, auxiliares, validação, envio |
| `optional.routes.ts` | `/api/opcionais` | Fornecedor, validade, estoque, lotes |

### Services — mapa de responsabilidades

| Service | Função |
|---------|--------|
| `csvFileService.ts` | Uploads em `temp/uploads/` (TTL 2h) |
| `csvService.ts` | Parse streaming, encoding, colunas |
| `auxiliaryService.ts` | Auxiliar `id;nome`, preview, cache |
| `folderCollectService.ts` | Coleta de pasta por nome de arquivo |
| `productValidationService.ts` | Pipeline de validação (fiscal, DCB, EAN…) |
| `listaControlado.ts` | Enum TMS `tlTipoListaControlado` |
| `productTmsMapper.ts` | Linha CSV → payload TMS |
| `sendJobService.ts` | Job de envio de produtos (lotes, pause/resume) |
| `controladoSuggestService.ts` | EAN → CMED → Portaria 344 |
| `dcbIndexService.ts`, `cmedIndexService.ts`, … | Índices JSON locais |
| `optionalSupplier\|Validity\|Stock\|LotJobService.ts` (×4) | Jobs das importações opcionais |

### Integração TMS (`backend/src/services/tms/`)

`tmsService.ts` é um **barrel** fino que reexporta `./tms`.

| Módulo | Conteúdo |
|--------|----------|
| `tmsConfig.ts` | `TMS_BASE_URL`, `getDefaultTmsBaseUrl()` |
| `tmsTypes.ts` | Tipos (`BatchInsertResult`, `TmsAuth`, …) |
| `tmsAuth.ts` | Basic Auth SHA-256 a partir da versão |
| `tmsClient.ts` | HTTP + paginação OData |
| `tmsAuxiliary.ts` | Insert/list de grupos, DCB, similar… |
| `tmsProductImport.ts` | `insertProduct`, `importarListaProdutos` |
| `tmsProductCatalog.ts` | Catálogos e existência de produtos |
| `tmsFiscal.ts` | `AliquotaICMS`, `ensureAliquotaPercent` |
| `tmsProductExtras.ts` | Barras adicionais, código fornecedor |
| `tmsStock.ts` | `SalvarListaEstoques` |
| `tmsLots.ts` | Lotes / kardex |
| `tmsValidity.ts` | Validade (sistema antigo) |

**Auth:** `IdentificacaoServidor` → `versao` + `idFilial` → Basic Auth. Cache ~30 min; retry em 401.

**Envio:** `sendJobService` usa `importarListaProdutos` (1 POST por lote, padrão 500 itens).

---

## Frontend

### Rotas (`App.tsx`)

| Rota | Página |
|------|--------|
| `/import/produtos` | Wizard principal de produtos |
| `/import/opcionais` | Fornecedor, validade, estoque, lotes |
| `/settings` | Configurações |

### Wizard de produtos

Estado em `useImportWizard.tsx` (Context + localStorage para URL TMS e UF).

```
auxiliary → file → errors → send
```

| Step | Componente | Ação |
|------|------------|------|
| Auxiliares | `AuxiliaryStep.tsx` | `grupo.csv` (obrig.) + demais |
| Produtos | `FileDropzone`, `FolderCollectPanel` | Upload ou pasta |
| Erros | `ErrorsStep`, `ControladoSuggestPanel` | Validação; “enviar só válidos” |
| Envio | `SendStep.tsx` | Job live, pause/resume/retry |

### Services frontend

| Arquivo | API |
|---------|-----|
| `services/csvService.ts` | `/api/csv/upload` |
| `services/productService.ts` | `/api/products/*` |
| `services/optionalService.ts` | `/api/opcionais/*` |

---

## Fluxo de dados (produtos)

```
CSV produtos ──POST /csv/upload──► csvFileService → fileId
CSV auxiliar ──POST /auxiliary/:entity──►
                      │
                      ▼
             POST /products/validate
             productValidationService
             (+ auxiliares + índices CMED/DCB/344)
                      │
                      ▼
             ErrorsStep (issues / enviar só válidos)
                      │
                      ▼
             POST /products/send/start
             sendJobService
               1. auxiliares (live)
               2. catálogos TMS
               3. mapCsvRowToProductPayload
               4. importarListaProdutos
                      │
                      ▼ poll GET /send/:jobId
                   SendStep
```

**Alternativa:** `POST /products/collect-folder` lê pasta no servidor e reconhece CSVs pelo nome.

---

## Jobs in-memory

| Job | Service | Controles |
|-----|---------|-----------|
| Envio produtos | `sendJobService` | start, pause, resume, cancel, retry-failures |
| Opcionais (×4) | `optionalSupplier\|Validity\|Stock\|LotJobService` | start, get, cancel |

Jobs em `Map` na memória do processo; TTL após conclusão. Reiniciar o backend perde jobs ativos.

---

## Índices de referência (offline)

Gerados por Python em `scripts/` (planilhas Anvisa não versionadas). Detalhes: [scripts/README.md](scripts/README.md).

Usados em validação/sugestão de controlados — **sem HTTP à Anvisa em runtime**.

---

## Convenções

- **Idioma:** código em inglês; mensagens de usuário e regras em português.
- **Imports backend:** extensão `.js` nos paths (ESM + TypeScript).
- **API:** prefixo `/api`; Vite proxy em dev.
- **Arquivos grandes:** `productValidationService.ts` e `sendJobService.ts` concentram domínio; TMS isolado em `tms/`.

---

## Testes e CI

| Área | Comando / local |
|------|-----------------|
| Unitários backend | `npm run test` (Vitest, `backend/src/**/*.test.ts`) |
| Lint frontend | `npm run lint` (Oxlint) |
| Build | `npm run build` |
| CI | `.github/workflows/ci.yml` em push/PR |
