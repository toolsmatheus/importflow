---
title: Um Domínio por Entidade (Sem Acoplamento entre DRE, DFC e Liquidez)
impact: CRITICAL
impactDescription: Evita acoplamento entre DRE, DFC e Liquidez
tags: architecture, modules, features
---

## Um Módulo/Feature por Domínio

**Impacto: CRITICAL**

Cada domínio financeiro (DRE, DFC, Liquidez, Exportação) tem seus próprios
arquivos em cada camada do backend (`controller/dre.controller.ts`,
`services/dre.service.ts`, `repository/dre.repository.ts`,
`models/dre.model.ts`) e sua própria feature no frontend
(`frontend/src/features/<domínio>/`). Ao implementar algo novo, siga o padrão de
uma entidade/feature já existente em vez de explorar toda a árvore `src/`.

**Errado (lógica de um domínio dentro de outro):**

```typescript
// backend/src/services/dre.service.ts
// Calculando saldo de caixa (regra do DFC) dentro do service da DRE
const saldoCaixa = await calcularSaldoCaixaDiario(filialId, periodo);
```

**Correto (cada domínio resolve sua própria regra, reusando `utils/` quando comum):**

```typescript
// backend/src/services/dfc.service.ts
import { rangeDoMes } from "../utils/period.js";

const saldoCaixa = await calcularSaldoCaixaDiario(filialId, rangeDoMes({ mes, ano }));
```

Utilitários realmente comuns aos três domínios (resolução de período,
comparação entre meses, detalhamento) ficam em `backend/src/utils/` —
não duplicá-los dentro de um módulo específico.

Referência: [AGENTS.md](AGENTS.md)
