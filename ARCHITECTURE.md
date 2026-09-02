# ImportFlow — Arquitetura

Guia para onboarding: como o monorepo se organiza, como os dados fluem do CSV até o TMS, e onde encontrar cada responsabilidade.

Documentação operacional (instalação, env vars, endpoints): [README.md](README.md).

---

## Visão geral

```
ImportFlow/
├── backend/          API Fastify (validação, jobs, integração TMS)
├── frontend/         Wizard React (importação de produtos e opcionais)
├── data/             CSVs de exemplo + índices JSON de referência (CMED, DCB, Portaria 344)
├── scripts/          Python — gera índices offline a partir de planilhas Anvisa
├── backend/scripts/  TypeScript — benchmarks e probes contra TMS local (dev only)
├── start.bat         Deploy one-click (build + serve :3001)
└── .env.example      Variáveis de ambiente
```

**Produção:** o backend na porta `3001` serve o frontend buildado (`frontend/dist`) e expõe `/api/*`. O TMS (ToolsPharma) roda separadamente (padrão `:2001`).

---

## Backend

### Camadas

```
server.ts
  └── routes/          Registro Fastify (/api)
        └── controllers/   HTTP: parse request, chama service, responde JSON
              └── services/   Lógica de negócio
                    └── tms/      Integração HTTP com o TMS (refatorado de tmsService.ts)
```

| Camada | Pasta | Papel |
|--------|-------|-------|
| Rotas | `backend/src/routes/` | Agrupa endpoints por domínio |
| Controllers | `backend/src/controllers/` | Validação de entrada, status HTTP, streaming NDJSON |
| Services | `backend/src/services/` | Validação de produtos, jobs, CSV, índices locais |
| TMS | `backend/src/services/tms/` | Auth, OData, insert/import bulk, estoque, lotes |
| Schemas | `backend/src/schemas/` | Headers CSV, entidades auxiliares, templates Zod |
| Utils | `backend/src/utils/` | Formatos BR, ICMS por UF, detecção de CSV |

### Rotas principais

| Módulo | Prefixo | Responsabilidade |
|--------|---------|------------------|
| `health.routes.ts` | `/api/health` | Saúde da API |
| `csv.routes.ts` | `/api/csv` | Upload genérico de CSV (fileId, análise de colunas) |
| `product.routes.ts` | `/api/products` | Wizard de produtos: templates, auxiliares, validação, envio |
| `optional.routes.ts` | `/api/opcionais` | Importações opcionais: barras, fornecedor, validade, estoque, lotes |

### Services — mapa de responsabilidades

| Service | Função |
|---------|--------|
| `csvFileService.ts` | Armazena uploads em `temp/uploads/` (TTL 2h) |
| `csvService.ts` | Parse streaming, encoding, estatísticas de colunas |
| `auxiliaryService.ts` | CSV auxiliar `id;nome`, preview, cache por entidade |
| `folderCollectService.ts` | Coleta automática de pasta por nome de arquivo |
| `productValidationService.ts` | Pipeline completo de validação (fiscal, DCB, EAN, auxiliares) |
| `productTmsMapper.ts` | Linha CSV → payload TMS (`mapCsvRowToProductPayload`) |
| `sendJobService.ts` | Job in-memory de envio de produtos (lotes, pause/resume) |
| `controladoSuggestService.ts` | EAN → CMED → Portaria 344 |
| `dcbIndexService.ts`, `cmedIndexService.ts`, etc. | Leitura de índices JSON locais (não HTTP) |
| `optional*JobService.ts` (×5) | Jobs in-memory para importações opcionais |

### Integração TMS (`backend/src/services/tms/`)

Módulos extraídos de `tmsService.ts` (barrel de compatibilidade: `tmsService.ts` reexporta tudo):

| Módulo | Conteúdo |
|--------|----------|
| `tmsConfig.ts` | `TMS_BASE_URL`, `getDefaultTmsBaseUrl()` |
| `tmsTypes.ts` | Tipos compartilhados (`BatchInsertResult`, `TmsAuth`, …) |
| `tmsAuth.ts` | Basic Auth SHA-256 a partir da versão do servidor |
| `tmsClient.ts` | `tmsJsonRequest`, paginação OData, parsers de resposta |
| `tmsAuxiliary.ts` | Insert/list de grupos, subgrupos, DCB, similar, … |
| `tmsProductImport.ts` | `insertProduct`, `importarListaProdutos` (bulk) |
| `tmsProductCatalog.ts` | Catálogos de lookup e existência de produtos |
| `tmsFiscal.ts` | `AliquotaICMS`, `ensureAliquotaPercent` |
| `tmsProductExtras.ts` | Códigos de barras adicionais, código fornecedor |
| `tmsStock.ts` | `SalvarListaEstoques` |
| `tmsLots.ts` | `LoteMedicamento`, kardex, `ExecuteSQL` para quantidade |
| `tmsValidity.ts` | `ValidadeSistemaAntigo` |

**Auth:** `GET IdentificacaoServidor` → `versao` + `idFilial` → Basic Auth com SHA-256. Cache 30 min; retry automático em 401.

**Envio de produtos:** `sendJobService` chama `importarListaProdutos` (1 POST por lote de até 500 produtos), não insert unitário.

---

## Frontend

### Rotas (`App.tsx`)

| Rota | Página |
|------|--------|
| `/import/produtos` | Wizard principal de produtos |
| `/import/opcionais` | Barras, fornecedor, validade, estoque, lotes |
| `/import/favorecidos` | Placeholder |
| `/import/financeiro` | Placeholder |
| `/settings` | Configurações |

### Wizard de produtos

Estado centralizado em `useImportWizard.tsx` (React Context + localStorage para TMS URL e UF).

```
auxiliary → file → errors → preview → send
```

| Step | Componente | Ação |
|------|------------|------|
| Auxiliares | `AuxiliaryStep.tsx` | Upload/preview de `grupo.csv` (obrig.) e demais |
| Produtos | `FileDropzone`, `FolderCollectPanel` | Upload manual ou coleta de pasta |
| Erros | `ErrorsStep`, `InconsistencyChecksPanel` | Checagens por categoria, export CSV |
| Prévia | `PreviewStep.tsx` | Grid editável + revalidação |
| Envio | `SendStep.tsx` | Job live/simulate, pause/resume/retry |

### Services frontend

| Arquivo | API |
|---------|-----|
| `services/csvService.ts` | `/api/csv/upload` (NDJSON progress) |
| `services/productService.ts` | `/api/products/*` |
| `services/optionalService.ts` | `/api/opcionais/*` |

---

## Fluxo de dados (produtos)

```
┌──────────────┐   POST /csv/upload    ┌─────────────────┐
│ CSV produtos │ ────────────────────► │ csvFileService  │ → fileId
└──────────────┘                       └────────┬────────┘
                                                │
┌──────────────┐   POST /auxiliary/:entity      │
│ CSV auxiliar │ ───────────────────────────────┤
└──────────────┘                                 │
                                                 ▼
                              POST /products/validate
                              ┌──────────────────────────────┐
                              │ productValidationService      │
                              │  + auxiliaryService           │
                              │  + índices CMED/DCB/344       │
                              └──────────────┬───────────────┘
                                             │ rows + issues
                                             ▼
                              Preview (edit) → validate-rows
                                             │
                                             ▼
                              POST /products/send/start
                              ┌──────────────────────────────┐
                              │ sendJobService                │
                              │  1. insert auxiliares (live)  │
                              │  2. fetch catálogos TMS       │
                              │  3. mapCsvRowToProductPayload │
                              │  4. importarListaProdutos     │
                              └──────────────────────────────┘
                                             │
                                             ▼ poll GET /send/:jobId
                                        SendStep UI
```

**Entrada alternativa:** `POST /products/collect-folder` lê pasta no servidor e carrega CSVs reconhecidos pelo nome.

---

## Jobs in-memory

| Job | Service | Controles |
|-----|---------|-----------|
| Envio produtos | `sendJobService` | start, pause, resume, cancel, retry-failures |
| Opcionais (×5) | `optional*JobService` | start, get, cancel (sem pause) |

Jobs ficam em `Map` na memória do processo; TTL 6h após conclusão. Reiniciar o backend cancela jobs ativos.

**Simulação:** modo `simulate` no envio de produtos — latência fake + ~1% falhas aleatórias, sem chamadas TMS.

---

## Índices de referência (offline)

Gerados por scripts Python em `scripts/` a partir de planilhas Anvisa (não versionadas):

| Script | Saída |
|--------|-------|
| `build_cmed_index.py` | `data/reference/cmed-ean-index.json` |
| `build_dcb_index.py` | `data/reference/dcb-index.json` |
| `build_controlado_indexes.py` | `portaria344.json`, `antimicrobianos.json` |
| `build_controlados_ean_index.py` | `controlados-ean-index.json` |

Usados em validação e sugestão de controlados — **sem chamada HTTP à Anvisa em runtime**.

---

## Convenções

- **Idioma:** nomes de código em inglês; mensagens de usuário e regras de negócio em português.
- **Imports backend:** extensão `.js` nos paths (ESM + TypeScript).
- **API:** prefixo `/api`; frontend usa proxy Vite em dev.
- **Arquivos grandes:** `productValidationService.ts` e `sendJobService.ts` concentram lógica de domínio; TMS isolado em `tms/`.

---

## Testes e CI

| Área | Status |
|------|--------|
| Testes automatizados | Vitest no backend (`npm run test`) |
| CI (GitHub Actions) | Build + lint + test em push/PR |
| Lint | Oxlint no frontend (`npm run lint`) |
| Dev manual | Modo simulate, scripts `backend/scripts/` |

**Fase 3:** Vitest no backend — ver `src/**/*.test.ts` e `npm run test`.
