---
title: Models em src/models e DTOs em src/dto, Compartilhados com o Frontend
impact: CRITICAL
impactDescription: Uma única definição dos contratos da API para backend e frontend
tags: architecture, models, dto
---

## Models em `backend/src/models` e DTOs em `backend/src/dto`

**Impacto: CRITICAL**

Todo tipo/interface vai para `backend/src/models/` ou `backend/src/dto/`, nunca
dentro de service, repository ou controller:

- `<entidade>.model.ts` — entidades, linhas de repositório, enumeradores e
  constantes que definem tipos (ex.: `dre.model.ts`, `auth.model.ts`)
- `dto/<entidade>.dto.ts` — DTOs: o formato exato que trafega na API (corpo de
  requisição e resposta). Nome com sufixo `Dto` (ex.: `DreResultadoDto`)

Arquivos em `models/` e `dto/` são **puros**: só tipos, enums e constantes, sem importar
express, mysql2 ou qualquer pacote de runtime. É isso que permite o frontend
importá-los (aliases `@models` e `@dto`, ver [architecture-frontend-data-layer](architecture-frontend-data-layer.md)).

**Errado (tipo declarado no service, frontend redeclara o mesmo formato):**

```typescript
// backend/src/services/dre.service.ts
export interface DreResultado { receitaBruta: number; /* ... */ }

// frontend/src/api/dre.ts
export interface DreResultado { receitaBruta: number; /* ... */ }   // cópia que pode divergir
```

**Correto (uma definição em models/ e dto/, controller devolve o DTO, frontend importa o mesmo):**

```typescript
// backend/src/dto/dre.dto.ts
export interface DreResultadoDto extends DreRubricas { indicadores: DreIndicadores; percentual: DrePercentuais }

// backend/src/controller/dre.controller.ts
const dto: DreResultadoDto = dre;
res.json(dto);

// frontend/src/api/dre.ts
import type { DreResultadoDto } from '@dto/dre.dto'
```

Dados que nunca podem sair do backend (ex.: a senha em `FuncionarioLogin`) ficam
só no `.model.ts`; o controller monta o DTO campo a campo.

Referência: [AGENTS.md](AGENTS.md)
