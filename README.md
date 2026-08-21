# ImportFlow

Importação de produtos via CSV para a API TMS (ToolsPharma), com validação antes do envio.

## Fluxo completo

1. **Modelo** — download do `modelo-produtos.csv` e dos modelos auxiliares
2. **Arquivo** — upload do CSV de produtos
3. **Auxiliares** — upload de `grupo.csv` (obrigatório) e demais entidades usadas (`id;nome`)
4. **Erros** — validação estrutural + vínculos; filtros, export CSV e ações de correção
5. **Prévia** — grid editável (colunas escolhíveis, só problemas, revalidação)
6. **Envio** — testar servidor, enviar ou **simular** (enquanto o TMS não estiver pronto)

## Estrutura

```
ImportFlow/
├── frontend/     # React + TypeScript + Vite
├── backend/      # Node.js + Fastify + TypeScript
└── data/         # Modelos e exemplos de CSV
```

## Pré-requisitos

- Node.js 20+
- npm
- Servidor TMS em `http://localhost:2001` (ou outra URL configurável na etapa de envio)

## Como executar

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend em `http://localhost:3001`.

Variável opcional: `TMS_BASE_URL` (padrão `http://localhost:2001`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend em `http://localhost:5173`.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/products/template` | Download do `modelo-produtos.csv` |
| `GET` | `/api/products/template/auxiliar/:entity` | Modelo `id;nome` |
| `GET` | `/api/products/catalog` | Catálogo de campos e regras |
| `POST` | `/api/products/auxiliary/:entity` | Upload de arquivo auxiliar |
| `POST` | `/api/products/validate` | Valida CSV + auxiliares (`fileId` + mapa de auxiliares) |
| `POST` | `/api/products/validate-rows` | Revalida linhas editadas na prévia |
| `GET` | `/api/products/identify-server` | Proxy para `IdentificacaoServidor` |
| `POST` | `/api/products/send` | Identifica filial e envia produtos ao insert |
| `GET` | `/api/health` | Saúde do serviço |

Entidades auxiliares: `grupo`, `subgrupo`, `categoria`, `laboratorio`, `grupodepreco`, `similar`, `dcb`.

## Regras fechadas

| Tema | Decisão |
|------|----------|
| Controlado sem DCB | **Bloqueia** — DCB obrigatório |
| CSOSN + CST ICMS juntos | **Alerta** |
| Arquivo auxiliar | Um CSV por entidade com colunas `id;nome` |
| Markup | `venda = custo * (1 + markup/100)` — inconsistência gera alerta |
| FP / controlados via EAN | Etapa futura |
| Payload do insert | Mapeamento provisório (XData) até a API TMS fechar o contrato |

## Payload de insert (provisório)

Cada produto é enviado como JSON com, entre outros: `idFilial`, `codigo_migracao`, `nome`, `idGrupo`, `custo`, `markup`, `venda`, `unidade`, `fator`, `listapiscofins`, `aliquotaicms`, `cfop`, `ncm`, `cstpis`/`cstcofins`, IDs auxiliares (`idSubgrupo`, …), flags S/N convertidas para boolean.

O contrato real do `ProdutoService/insert` ainda pode mudar — o ImportFlow isola o mapeamento em `backend/src/services/tmsService.ts`.

## Dados de exemplo

| Arquivo | Descrição |
|---------|-----------|
| `data/modelo-produtos.csv` | Modelo completo com 12 produtos de exemplo (sem FP/controlados) |
| `data/modelo-auxiliar.csv` | Modelo genérico `id;nome` |
| `data/exemplos/*.csv` | Auxiliares alinhados ao exemplo do modelo |
| `data/produtos-invalid-example.csv` | Casos de erro/alerta |
