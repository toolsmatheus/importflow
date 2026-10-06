# ImportFlow — Arquitetura

Guia alinhado às regras nesta pasta (padrão ToolsPharma), adaptado ao domínio CSV → TMS.

- Índice: [README.md](README.md)
- Regras de agentes: [AGENTS.md](AGENTS.md)
- Setup: [CONTRIBUTING.md](CONTRIBUTING.md)
- Validações: [VALIDACOES.md](VALIDACOES.md)

---

## Visão geral

```
ImportFlow/
├── agents/           # Toda a documentação .md do projeto
├── design-system/    # Tokens/fonts/logo ToolsPharma
├── backend/
│   ├── src/          # controller, services, models, dto, …
│   └── tests/        # testes unitários Vitest
├── frontend/src/
│   ├── api/
│   ├── features/
│   ├── components/
│   └── layouts/
├── data/
├── start.bat
└── package.json
```

**Sem SQL próprio:** `services/tms/` é a integração externa (papel de repository). Não criar `database/`, `middleware/` ou ORM vazios.

**Produção / cliente:** backend `:3001` serve `frontend/dist` + `/api/*`. TMS separado (`:2001`).

---

## Backend — camadas

Fluxo: `routes → controller → services → tms`.

| Pasta | Papel |
|-------|--------|
| `controller/` | Lê HTTP, chama service, devolve DTO |
| `services/` | Validação, envio, opcionais, índices |
| `tms/` | Auth/OData/bulk TMS |
| `models/` | Tipos/enums/constantes (sem Fastify) |
| `dto/` | Request/response da API |

Arquivos: `<entidade>.<camada>.ts` (ex.: `produto.controller.ts`, `envio.service.ts`).

---

## Frontend — features + api

- Componentes **não** chamam `fetch` — só `frontend/src/api/`.
- Tipos de API vêm de `@dto` / `@models` (aliases no Vite/tsconfig).
- UI de domínio em `features/<domínio>/`.
- Design system em `components/` (tokens em `design-system/` + `components/tokens.css`).

---

## Fluxo produtos (resumo)

```
CSV → api/csv + api/produto → validação (produto.service)
    → EtapaErros → envio.service → tms.importarListaProdutos
    → poll SnapshotEnvioJobDto
```

---

## Convenções

- Código e mensagens em português; nomes TMS/API HTTP mantidos.
- ICMS por UF: só `backend/src/utils/icmsByUf.ts`.
- Testes: `npm run test` (em `backend/tests/`) · Build: `npm run build`.
