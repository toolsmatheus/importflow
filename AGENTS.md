# AGENTS.md — ImportFlow

Instruções para humanos e agentes de IA que alteram este repositório.

## O que é este projeto

Monorepo de **importação CSV → ToolsPharma (TMS)**. Não é um CRUD de produtos: o fluxo é validar e enviar em lotes.

Docs: [README.md](README.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [VALIDACOES.md](VALIDACOES.md)

## Não inventar

- **Pastas vazias** (`database/`, `jobs/`, `middleware/`) — jobs ficam em `backend/src/services/`.
- **Rotas Favorecidos / Financeiro** — não existem neste repo (só produtos + opcionais).
- **5º job opcional “Barras+”** — removido; barras adicionais vão no CSV de produtos (`codigoadicional`).
- **Simular lotes na UI de produtos** — o wizard envia `live`; `simulate` existe na API/opcionais.
- **Chamadas HTTP à Anvisa em runtime** — índices offline em `data/reference/`.
- **Camadas novas sem necessidade** (repositories, DI containers, ORM) — manter Fastify → routes → controllers → services → `tms/`.

## Onde mexer

| Mudança | Local |
|---------|--------|
| Regra de validação | `backend/src/services/validation/` |
| Enum lista controlado TMS | `listaControlado.ts` |
| Payload produto TMS | `productTmsMapper.ts` |
| HTTP TMS | `backend/src/services/tms/` |
| Job envio produtos | `sendJobService.ts` (+ pasta `send/` se existir) |
| Jobs opcionais | `optionalJobRuntime.ts` + `optional*JobService.ts` |
| Wizard UI | `frontend/src/components/wizard/` |
| Opcionais UI | `frontend/src/components/optional/` |
| Tabela ICMS por UF | **só** `backend/src/utils/icmsByUf.ts` (front via `@importflow/icms`) |

## Convenções

- Código em inglês; mensagens de usuário em português.
- Backend ESM: imports com sufixo `.js`.
- Preferir teste Vitest ao mudar validação, mapper ou ICMS.
- Não commit de `.env`, `node_modules/`, `dist/`, `.runtime/`, segredos.
- Commit/push só quando o usuário pedir.

## Cliente Windows

`start.bat` + `scripts/ensure-node.ps1` / `pack-client.ps1`. Não quebrar o one-click ao refatorar scripts da raiz.
