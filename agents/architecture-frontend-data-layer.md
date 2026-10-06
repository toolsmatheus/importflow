---
title: Toda Chamada HTTP Passa por frontend/src/api/
impact: HIGH
impactDescription: Centraliza tratamento de erro e base URL da API
tags: architecture, frontend, api
---

## Toda Chamada HTTP Passa por `frontend/src/api/`

**Impacto: HIGH**

Componentes React nunca chamam `fetch` diretamente. Toda comunicação com o
backend passa por uma função em `frontend/src/api/`, que os componentes/hooks
importam.

**Errado (fetch direto no componente):**

```typescript
// frontend/src/features/dfc/DfcTable.tsx
const dfc = await fetch(`${API_BASE_URL}/api/dfc?mes=${mes}&ano=${ano}`).then(r => r.json());
```

**Correto (componente chama a camada `api/`):**

```typescript
// frontend/src/api/dfc.ts
export async function buscarDfc(mes: number, ano: number, filialIds: number[]) {
  const res = await fetch(`${API_BASE_URL}/api/dfc?mes=${mes}&ano=${ano}&filialId=${filialIds.join(',')}`);
  if (!res.ok) throw new Error("Falha ao buscar DFC");
  return res.json();
}

// frontend/src/features/dfc/DfcTable.tsx
import { buscarDfc } from "../../api/dfc";
const dfc = await buscarDfc(mes, ano, filialIds);
```

### Tipos vêm das models do backend

O frontend não redeclara tipos de resposta da API: importa os DTOs/models do
backend pelos aliases `@models` e `@dto` (`frontend/vite.config.ts` e
`tsconfig.app.json` apontam para `backend/src/models` e `backend/src/dto`).

```typescript
// frontend/src/api/dfc.ts
import type { DfcResultadoDto } from '@dto/dfc.dto'

export async function buscarDfc(/* ... */): Promise<DfcResultadoDto> { /* ... */ }
```

Ver [architecture-models-dto](architecture-models-dto.md).

Referência: [AGENTS.md](AGENTS.md)
