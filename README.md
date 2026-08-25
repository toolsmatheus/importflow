# ImportFlow

Importação de produtos via CSV para o banco de dados (ToolsPharma), com validação e envio em lotes.

## Fluxo

1. Modelo: download do `modelo-produtos.csv` e auxiliares
2. Arquivo: upload manual **ou** coleta automática de uma pasta (`produtos.csv`, `grupo.csv`, ...)
3. Auxiliares: `grupo.csv` (obrigatório) e demais usados (`id;nome`)
4. Erros: validação com filtros e export CSV
5. Prévia: grid editável e revalidação
6. Envio: lotes com progresso, pausa, retomar e reenvio de falhas (ou simulação sem gravar no banco)

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

## Envio em lotes

| Parâmetro | Padrão | Env |
|-----------|--------|-----|
| Tamanho do lote | 100 | `SEND_BATCH_SIZE` |
| Lotes em paralelo | 2 | `SEND_CONCURRENCY` |
| Body máx. do start | 80 MB | (Fastify `bodyLimit`) |

Endpoints:

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/products/send/start` | Inicia job (`mode: live \| simulate`) |
| `GET` | `/api/products/send/:jobId` | Progresso |
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
| `POST` | `/api/products/auxiliary/:entity` | Upload auxiliar |
| `POST` | `/api/products/validate` | Validação CSV + auxiliares |
| `POST` | `/api/products/validate-rows` | Revalidação da prévia |
| `GET` | `/api/products/identify-server` | Identificação da filial |
| `GET` | `/api/health` | Saúde |

## Dados de exemplo

| Arquivo | Descrição |
|---------|-----------|
| `data/modelo-produtos.csv` | 12 produtos de exemplo (sem FP/controlados) |
| `data/modelo-auxiliar.csv` | Modelo `id;nome` |
| `data/exemplos/*.csv` | Auxiliares de exemplo |
| `data/produtos-invalid-example.csv` | Casos de erro/alerta |

Variáveis úteis: `PORT`, `TMS_BASE_URL` (URL do banco), `SEND_BATCH_SIZE`, `SEND_CONCURRENCY`.
