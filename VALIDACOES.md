# Validações do ImportFlow

Documento resumido das checagens feitas ao processar **auxiliares** e **produtos**.

## Severidade

| Tipo | Efeito |
|------|--------|
| **error** | Bloqueia o envio (`canProceed = false` enquanto `errorCount > 0`) |
| **warning** | Não bloqueia; aparece na etapa Erros / resumo |

---

## Auxiliares

Arquivos: `grupo`, `subgrupo`, `categoria`, `laboratorio`, `grupodepreco`, `similar`, `dcb`  
Modelo: `id;nome` (também aceita `codigo` no lugar de `id`)

- [ ] **id vazio** — linha ignorada no catálogo · **warning**
- [ ] **id duplicado** no mesmo arquivo — mantém a primeira · **warning**
- [ ] **arquivo sumiu do storage** (reenvio necessário) · **error**
- [ ] **grupo obrigatório** na validação de produtos (`grupo.csv`) · **error**
- [ ] **id citado no produto existe no catálogo** · **error**
- [ ] **auxiliar ausente com coluna preenchida** no produto (ex.: `laboratorio` preenchido sem `laboratorio.csv`) · **error**

Mapeamento produto → auxiliar:

| Campo no produto | Arquivo auxiliar |
|------------------|------------------|
| `codigogrupo` | `grupo` *(obrigatório)* |
| `subgrupo` | `subgrupo` |
| `categoria` | `categoria` |
| `laboratorio` | `laboratorio` |
| `grupodepreco` | `grupodepreco` |
| `similar` | `similar` |
| `dcb` | `dcb` *(também consulta banco TMS e base Anvisa)* |

---

## Produtos — arquivo

Cabeçalhos obrigatórios:  
`codigo`, `nome`, `codigogrupo`, `custo`, `venda`, `fator`, `listapiscofins`, `aliquota`, `ncm`, `cstpiscofins`

- [ ] **cabeçalhos obrigatórios** presentes · **error**
- [ ] **colunas desconhecidas** (fora do modelo) · **warning**
- [ ] **arquivo vazio** (sem registros) · **error**
- [ ] **`codigo` duplicado** no arquivo · **error**

---

## Produtos — linha

### Preenchimento e identificação

- [ ] **campos obrigatórios preenchidos** (não em branco) · **error**
- [ ] **`codigo` só dígitos** (sem letras) · **error**
- [ ] **`nome` válido** (não vazio, não só números) · **error**
- [ ] **`codigogrupo` inteiro** se preenchido · **error**

### Números e markup

- [ ] **números no formato BR** válidos (`custo`, `venda`, `fator`, `aliquota` e decimais opcionais) · **error**
- [ ] **markup vazio / inválido / inconsistente** com custo e venda → **recalcula automaticamente** · **warning**
- [ ] **markup não recalculável** (falta custo/venda válidos ou custo = 0) · **error**

Decimais opcionais checados: `valorpmc`, `estoque`, `descontofixo`, `comissao`, `demanda`, `descontomax`, `qtdfciapop`, `valorfciapop`

### Fiscal (alíquota, ST, isento, PIS/COFINS, NCM, CFOP)

- [ ] **`aliquota = 0`** → exatamente uma de `st` ou `isento` = `S` (não ambas, não nenhuma) · **error**
- [ ] **`st` e `isento` ambos `S`** · **error**
- [ ] **`aliquota` diferente da padrão da UF do cliente** · **warning**
- [ ] **`listapiscofins`** ∈ `NEUTRA` \| `POSITIVA` \| `NEGATIVA` · **error**
- [ ] **`cfop`** com 4 dígitos (se preenchido) · **error**
- [ ] **`ncm`** com 8 dígitos · **error**

### Código de barras

- [ ] **EAN inválido** (tamanho ou dígito verificador) · **warning** *(não bloqueia)*

### IDs, flags e status

- [ ] **IDs auxiliares inteiros** se preenchidos (`subgrupo`, `categoria`, `laboratorio`, `grupodepreco`, `similar`, `dcb`) · **error**
- [ ] **flags `S` ou `N`**: `atualizaestoque`, `st`, `isento`, `semincidencia`, `permitedesconto`, `usocontinuo`, `medfciapop` · **error**
- [ ] **`ativo`** = `A` ou `I` (se preenchido) · **error**

### Descontos e Farmácia Popular

- [ ] **`descontofixo` ≤ `descontomax`** · **warning**
- [ ] **`medfciapop = S`** → `qtdfciapop` e `valorfciapop` obrigatórios · **error**

### Controlados

- [ ] **DCB resolvível** (auxiliar **ou** tabela DCB do banco **ou** base Anvisa) · se não achar → **anula controlado** (limpa lista/DCB/MS e afins) · **warning**
- [ ] **`registroms` obrigatório** quando o controlado é mantido (`listacontrole` + DCB ok) · **error**
- [ ] **refs auxiliares existentes** (ids do produto batem com o catálogo) · **error**

---

## Ajustes automáticos na validação

Além de reportar problemas, a validação pode **alterar a linha**:

1. **Recalcula `markup`** a partir de custo e venda (com aviso)
2. **Anula controlado** quando o DCB não é encontrado (com aviso)
3. Pode **criar a coluna `markup`** se ela não existia e foi calculada

---

## O que ainda não é validado

Para planejamento de novas checagens:

- Domínio de `listacontrole` (A1, B1, T…)
- Formato de `cstpiscofins`, `cest`, `csosn`, `csticms`
- EAN duplicado no arquivo ou no banco
- Existência do produto no TMS (só no envio)
- Qualidade do `nome` no auxiliar
- Sugestão de controlados (CMED) — fluxo separado, não é validação bloqueante

---

## Onde alterar no código

| O quê | Onde |
|-------|------|
| Regras de linha / severidade | `backend/src/services/productValidationService.ts` |
| Carga dos auxiliares | `backend/src/services/auxiliaryService.ts` |
| Cabeçalhos e enums | `backend/src/schemas/product.schema.ts` |
| Formatos (EAN, NCM, markup…) | `backend/src/utils/productFormats.ts` |
| Alíquota por UF | `backend/src/utils/icmsByUf.ts` |
| Checklist na tela (Erros) | `VALIDATION_CHECK_DEFS` no mesmo service de validação |

Após mudar o backend em produção: rebuild (`start.bat /rebuild` ou rebuild automático se o source estiver mais novo que o `dist`).
