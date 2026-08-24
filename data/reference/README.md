# Referências para sugestão de controlados

| Arquivo | Uso |
|---|---|
| `cmed.xlsx` | Fonte CMED (local; não versionado). Regenerar o índice com `python scripts/build_cmed_index.py`. |
| `dcb.xlsx` | Lista consolidada Anvisa (local; não versionado). Regenerar com `python scripts/build_dcb_index.py`. |
| `dcb-index.json` | Código DCB (5 dígitos) → nome. |
| `cmed-ean-index.json` | Índice EAN → substância/registro/tarja (usado em runtime). |
| `portaria344.json` | Mapa curado substância → lista (A1, B1, C1…). Revisar com atualizações da Anvisa. |

Fluxo: **EAN → CMED → Portaria 344 → listacontrole**; DCB vem do auxiliar `dcb.csv` por nome, se enviado.
