# ImportFlow

Importação de produtos via CSV para o banco de dados (ToolsPharma), com validação e envio em lotes.

## Fluxo do wizard

1. **Auxiliares** — upload de `grupo.csv` (obrigatório) e demais auxiliares (`id;nome`); prévia read-only por arquivo; download de modelos
2. **Produtos** — upload manual **ou** coleta automática de pasta (`produtos.csv`, `grupo.csv`, …); identificação da filial e UF
3. **Erros** — validação com checagens expansíveis por categoria; export CSV de inconsistências
4. **Prévia** — grid editável e revalidação
5. **Envio** — lotes via `ImportarListaProdutos`, com progresso, pausa, retomar e reenvio de falhas (ou simulação sem gravar)

### Regras automáticas (validação)

- **CFOP** — não é coluna obrigatória: ST → 5405; alíquota ICMS > 0 → 5102; alíquota 0 exige ST ou isento
- **Markup** — se vazio ou inconsistente com custo/venda, é recalculado com aviso
- **EAN inválido** — alerta (não bloqueia o envio)

## Uso no cliente

Com Node.js 20+ instalado, dê **duplo clique** em:

```bat
start.bat
```

Na primeira execução ele:
1. Instala dependências (se faltar `node_modules`)
2. Gera o build (se faltar `frontend/dist` ou `backend/dist`)
3. Sobe API + interface em `http://localhost:3001` e abre o navegador

Nas próximas vezes, se o build já existir, só sobe o servidor (mais rápido).

Para forçar rebuild:

```bat
start.bat /rebuild
```

## Desenvolvimento local

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
```

- Backend: `http://localhost:3001`
- Frontend (Vite): `http://localhost:5173` (proxy `/api` para o backend)

Copie `.env.example` para `.env` e ajuste se necessário.

## Envio em lotes

O envio usa a rota TMS **`ImportarListaProdutos`** (bulk por lote), não insert unitário.

| Parâmetro | Padrão | Env |
|-----------|--------|-----|
| Tamanho do lote | 500 | `SEND_BATCH_SIZE` |
| Lotes em paralelo | 1 | `SEND_CONCURRENCY` |
| Body máx. do start | 80 MB | (Fastify `bodyLimit`) |

Endpoints:

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/products/send/start` | Inicia job (`mode: live \| simulate`) |
| `GET` | `/api/products/send/:jobId` | Progresso |
| `GET` | `/api/products/send/:jobId/skipped.csv` | CSV de produtos ignorados |
| `POST` | `/api/products/send/:jobId/pause` | Pausa |
| `POST` | `/api/products/send/:jobId/resume` | Retoma |
| `POST` | `/api/products/send/:jobId/cancel` | Cancela |
| `POST` | `/api/products/send/:jobId/retry-failures` | Reenvia só falhas |

Enquanto o banco de destino não estiver disponível, use **Simular lotes** para testar 5k–20k produtos.

## Outros endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/products/template` | Modelo de produtos |
| `GET` | `/api/products/template/auxiliar/:entity` | Modelo auxiliar |
| `GET` | `/api/products/catalog` | Catálogo de campos |
| `POST` | `/api/products/collect-folder` | Lê pasta local e carrega CSVs pelo nome |
| `GET` | `/api/products/folder-expect` | Lista nomes de arquivo reconhecidos |
| `GET` | `/api/products/auxiliary/preview/:fileId` | Prévia read-only de CSV auxiliar |
| `POST` | `/api/products/auxiliary/:entity` | Upload auxiliar |
| `POST` | `/api/products/validate` | Validação CSV + auxiliares |
| `POST` | `/api/products/validate-rows` | Revalidação da prévia |
| `POST` | `/api/products/suggest-controlados` | Sugestões de controlados (CMED) |
| `GET` | `/api/products/identify-server` | Identificação da filial |
| `GET` | `/api/health` | Saúde |

## Dados de exemplo

| Arquivo | Descrição |
|---------|-----------|
| `data/modelo-produtos.csv` | 12 produtos de exemplo (sem FP/controlados) |
| `data/modelo-auxiliar.csv` | Modelo `id;nome` |
| `data/exemplos/*.csv` | Auxiliares de exemplo |
| `data/produtos-invalid-example.csv` | Casos de erro/alerta |

## Scripts de benchmark

Ferramentas de desenvolvimento em `backend/scripts/` — ver [backend/scripts/README.md](backend/scripts/README.md).

## Testes

```bash
npm run test          # unitários (Vitest, backend)
npm run lint          # oxlint (frontend)
npm run build         # build completo
```

CI (`.github/workflows/ci.yml`): lint + build + test em push/PR para `master`/`main`.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3001` | Porta da API |
| `TMS_BASE_URL` | `http://localhost:2001` | URL do TMS |
| `TMS_AUTH_SUFFIX` | (interno) | Sufixo da senha Basic Auth |
| `SEND_BATCH_SIZE` | `500` | Produtos por lote no envio |
| `SEND_CONCURRENCY` | `1` | Lotes em paralelo |

Ver `.env.example` para um template completo.

Arquitetura detalhada (fluxo de dados, camadas, jobs, TMS): [ARCHITECTURE.md](ARCHITECTURE.md).
