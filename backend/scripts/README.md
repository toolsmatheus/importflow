# Scripts de desenvolvimento (TMS)

Utilitários para benchmark e diagnóstico contra um TMS local. **Não são usados em produção.**

Requisitos: TMS em execução (padrão `http://localhost:2001`), dependências do backend instaladas.

Execute a partir de `backend/`:

```bash
cd backend
npx tsx scripts/<script>.ts
```

Variáveis opcionais: `TMS_BASE_URL`, `BENCH_RUN_ID` (ver `.env.example` na raiz).

| Script | Descrição |
|--------|-----------|
| `benchmark-product-import.ts` | Compara insert 1 a 1 vs `ImportarListaProdutos` (`--sizes=10,25,50,100`) |
| `benchmark-lista-only.ts` | Benchmark só da rota em lista |
| `benchmark-seq-small.ts` | Insert sequencial pequeno (smoke test) |
| `probe-grupos.ts` | Lista amostras de `GrupoProdutoDrogaria` e `AliquotaICMS` |
| `probe-insert-once.ts` | Um insert de produto com catálogos reais |
| `verify-bench-products.ts` | Confere se códigos de benchmark existem no TMS |
