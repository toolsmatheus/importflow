---
title: Camadas Planas por Responsabilidade (Controller → Service → Repository)
impact: HIGH
impactDescription: Mantém SQL isolado e a lógica de negócio testável
tags: architecture, backend, layers
---

## Controller → Service → Repository

**Impacto: HIGH**

O backend é organizado **por camada**, em pastas planas dentro de `backend/src/`,
e os arquivos mantêm o padrão `<entidade>.<camada>.ts`:

| Pasta | Arquivo | Responsabilidade |
|---|---|---|
| `controller/` | `dre.controller.ts` | lê a requisição HTTP, chama o service, devolve o **DTO** |
| `services/` | `dre.service.ts` | regra de negócio (competência vs. caixa, cálculo de rubricas) |
| `repository/` | `dre.repository.ts` | única camada que executa SQL |
| `middleware/` | `auth.middleware.ts` | interceptadores do Express (sessão, etc.) |
| `models/` | `dre.model.ts` | tipos, enumeradores e constantes (ver [architecture-models-dto](architecture-models-dto.md)) |
| `dto/` | `dre.dto.ts` | contratos da API: corpo de requisição e resposta |

Fluxo de dependência: `controller → services → repository → db`. `models/` e `dto/` podem ser
importados por todas as camadas, mas não importa nenhuma delas.

**Errado (SQL direto no controller/service):**

```typescript
// dre.controller.ts
app.get("/api/dre", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM venda WHERE idfilial = ?", [filialId]);
  res.json(rows);
});
```

**Correto (controller delega ao service, service delega ao repository):**

```typescript
// controller/dre.controller.ts
export async function getDre(req: Request, res: Response) {
  const resultado = await dreService.gerar(req.query);
  res.json(resultado);
}

// services/dre.service.ts
export async function gerar(params: DreParams) {
  const vendas = await dreRepository.buscarVendasPorPeriodo(params);
  return calcularRubricas(vendas);
}

// repository/dre.repository.ts
export async function buscarVendasPorPeriodo(params: DreParams) {
  return pool.query("SELECT * FROM venda WHERE idfilial = ? AND dataVenda BETWEEN ? AND ?", [...]);
}
```

Referência: [AGENTS.md](AGENTS.md)
