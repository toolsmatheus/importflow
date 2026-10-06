# Como contribuir — ImportFlow

## Setup local

Pré-requisito: **Node.js 20+**.

```bash
npm install
copy .env.example .env
```

```bash
npm run dev:backend    # :3001
npm run dev:frontend   # :5173 (proxy /api)
```

Cliente: `start.bat` → `http://localhost:3001`.

## Arquitetura (obrigatório)

Leia [README.md](README.md) e [AGENTS.md](AGENTS.md) nesta pasta.

| Quero… | Vá em… |
|--------|--------|
| Endpoint HTTP | `backend/src/controller/` + `routes/` |
| Regra de validação | `backend/src/services/validacao/` |
| Contrato API | `backend/src/dto/`, `backend/src/models/` |
| Integração TMS | `backend/src/services/tms/` |
| Chamada HTTP no browser | `frontend/src/api/` |
| UI produtos | `frontend/src/features/produtos/` |
| UI opcionais | `frontend/src/features/opcionais/` |
| Design system | `frontend/src/components/` |
| ICMS por UF | `backend/src/utils/icmsByUf.ts` |

## Comandos

| Comando | O que faz |
|---------|-----------|
| `npm run test` | Vitest (`backend/tests/`) |
| `npm run lint` | Oxlint (frontend) |
| `npm run build` | Build front + back |
| `scripts\pack-client.ps1` | Zip cliente |

## Convenções

- Identificadores em português; mensagens em português.
- Sem `fetch` em componentes — só `api/`.
- Sem redeclarar DTOs no front — `@dto` / `@models`.
- Sem pastas vazias `database/`, `middleware/`, ORM.
- Backend ESM com sufixo `.js`.
