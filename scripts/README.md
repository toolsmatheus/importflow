# Scripts — ToolsDataWeb

Três lugares distintos. Não misturar papéis.

## `scripts/` (raiz) — índices Anvisa + cliente Windows

### Python (índices offline)

Geram JSON em `data/reference/` a partir de planilhas Anvisa **não versionadas**.  
Runtime de validação/sugestão **não** chama a Anvisa pela rede.

| Script | Saída típica |
|--------|----------------|
| `build_cmed_index.py` | `data/reference/cmed-ean-index.json` |
| `build_dcb_index.py` | `data/reference/dcb-index.json` |
| `build_controlado_indexes.py` | `portaria344.json`, `antimicrobianos.json` |
| `build_controlados_ean_index.py` | `controlados-ean-index.json` |
| `make_controlados_test_csv.py` | CSV de teste |
| `make_produtos_50_reais.py` | CSV de amostra |

Detalhes dos índices: [data/reference/README.md](../data/reference/README.md).

### PowerShell (cliente / start.bat)

| Script | Uso |
|--------|-----|
| `ensure-node.ps1` | Garante Node ≥ 20 (PATH ou `.runtime\node`) — chamado pelo `start.bat` |
| `client-wait-open.ps1` | Espera `/api/health` e abre o browser |
| `pack-client.ps1` | Gera `dist-client\ToolsDataWeb-cliente.zip` |

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pack-client.ps1
```

## `backend/scripts/` — TMS local (dev)

Benchmarks e probes contra ToolsPharma em `:2001`.  
Ver [backend/scripts/README.md](../backend/scripts/README.md).

Não entram no fluxo do cliente (`start.bat`).

## O que não vai aqui

- Lógica de validação/envio → `backend/src/services/`
- UI do wizard → `frontend/src/`
