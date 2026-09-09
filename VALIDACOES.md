# Validações do ImportFlow

Documento resumido das checagens feitas ao processar **auxiliares** e **produtos**, com **exemplo de caso** em cada situação.

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
  *Ex.:* `grupo.csv` com linha `;Medicamentos` (sem id) → aviso e linha fora do catálogo.

- [ ] **id duplicado** no mesmo arquivo — mantém a primeira · **warning**  
  *Ex.:* duas linhas `1;Medicamentos` e `1;Perfumaria` → aviso; fica só “Medicamentos”.

- [ ] **arquivo sumiu do storage** (reenvio necessário) · **error**  
  *Ex.:* validar produtos citando um `fileId` de auxiliar que já expirou/foi apagado.

- [ ] **grupo obrigatório** na validação de produtos (`grupo.csv`) · **error**  
  *Ex.:* validar `produtos.csv` sem ter enviado `grupo.csv`.

- [ ] **id citado no produto existe no catálogo** · **error**  
  *Ex.:* produto com `codigogrupo=99`, mas `grupo.csv` só tem ids `1` e `2`.

- [ ] **auxiliar ausente com coluna preenchida** · **error**  
  *Ex.:* produto com `laboratorio=5` e nenhum `laboratorio.csv` enviado.

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
`codigo`, `nome`, `codigogrupo`, `custo`, `venda`, `fator`, `listapiscofins`, `aliquota`, `ncm`, `cstpiscofins`, `atualizaestoque`, `atualizarpreco`, `pagarpremicao`, `permitedesconto`

- [ ] **cabeçalhos obrigatórios** presentes · **error**  
  *Ex.:* CSV sem a coluna `ncm` no cabeçalho.

- [ ] **colunas desconhecidas** (fora do modelo) · **warning**  
  *Ex.:* coluna `cor` ou `fornecedor_xyz` que não existe no template.

- [ ] **arquivo vazio** (sem registros) · **error**  
  *Ex.:* só a linha de cabeçalho, nenhuma linha de produto.

- [ ] **`codigo` duplicado** no arquivo · **error**  
  *Ex.:* duas linhas com `codigo=10001`.

---

## Produtos — linha

### Preenchimento e identificação

- [ ] **campos obrigatórios preenchidos** (não em branco) · **error**  
  *Ex.:* `nome` vazio (`10001;;1;10,00;…`).

- [ ] **`codigo` só dígitos** (sem letras) · **error**  
  *Ex.:* `codigo=ABC123` ou `codigo=10A`.

- [ ] **`nome` válido** (não vazio, não só números) · **error**  
  *Ex.:* `nome=12345` (somente números).

- [ ] **`codigogrupo` inteiro** se preenchido · **error**  
  *Ex.:* `codigogrupo=1A` ou `codigogrupo=grupo1`.

### Flags S/N obrigatórias

| Coluna CSV | Envio TMS | Exemplo |
|------------|-----------|---------|
| `atualizaestoque` | `atualizarestoque` | `S` / `N` |
| `atualizarpreco` | `atualizarpreco` | `S` / `N` |
| `pagarpremicao` | `pagarcomissao` | `S` / `N` |
| `permitedesconto` | `permitirdescontovenda` | `S` / `N` |

- [ ] **flags obrigatórias preenchidas** · **error**  
  *Ex.:* `atualizarpreco` em branco.

- [ ] **flags = `S` ou `N`** · **error**  
  *Ex.:* `pagarpremicao=SIM` ou `permitedesconto=1`.

### Números e markup

- [ ] **números no formato BR** válidos · **error**  
  *Ex.:* `custo=dez reais` ou `venda=10.abc` → “Valor numérico inválido”.  
  *Ok:* `10,50` / `1.234,56`.

- [ ] **`custo` > `venda`** · **warning** *(mesmo tratamento do desconto fixo > máximo)*  
  *Ex.:* `custo=20,00` e `venda=15,00` → aviso; não bloqueia o envio.

- [ ] **markup vazio / inválido / inconsistente** → **recalcula** · **warning**  
  *Ex.:* `custo=10,00`, `venda=15,00`, `markup=` (vazio) → grava `50,00` e avisa.  
  *Ex.:* `custo=10`, `venda=15`, `markup=10` (deveria ser 50) → recalcula para `50,00`.

- [ ] **markup não recalculável** · **error**  
  *Ex.:* `markup` vazio e `custo=0` (ou custo/venda inválidos) → não dá para calcular.

Decimais opcionais checados: `valorpmc`, `estoque`, `descontofixo`, `comissao`, `demanda`, `descontomax`, `qtdfciapop`, `valorfciapop`

### Fiscal (alíquota, ST, isento, PIS/COFINS, NCM, CFOP)

- [ ] **`aliquota = 0`** → verifica `st` / `isento` (exatamente uma = `S`) · **error**  
  *Ex. erro:* `aliquota=0`, `st=N`, `isento=N` (nenhuma).  
  *Ex. erro:* `aliquota=0`, `st=S`, `isento=S` (ambas).  
  *Ex. ok:* `aliquota=0`, `st=S`, `isento=N` **ou** `st=N`, `isento=S`.

- [ ] **`aliquota > 0`** → **não** cruza `st`/`isento`; usa a alíquota (envio CFOP 5102)  
  *Ex.:* `aliquota=18`, `st=S` → ok na validação; no envio aplica alíquota/CFOP 5102.

- [ ] **`aliquota` diferente da padrão da UF** · **warning**  
  *Ex.:* cliente UF=`SP` (padrão 18%) e produto com `aliquota=17`.

- [ ] **`listapiscofins`** ∈ `NEUTRA` \| `POSITIVA` \| `NEGATIVA` · **error**  
  *Ex.:* `listapiscofins=ISENTA` ou `listapiscofins=positiva` (valor fora da lista).

- [ ] **`cfop`** com 4 dígitos (se preenchido) · **error**  
  *Ex.:* `cfop=510` ou `cfop=5102A`.

- [ ] **`ncm`** com 8 dígitos · **error**  
  *Ex.:* `ncm=3004` (curto) ou `ncm=3004909A`.

### Código de barras

- [ ] **EAN inválido** (tamanho ou dígito verificador) · **warning**  
  *Tamanhos aceitos:* **8**, **12** (UPC-A), **13**, **14** dígitos.  
  *Ex.:* `codigobarras=123` (tamanho) ou EAN-13 com dígito final errado.  
  *Não bloqueia o envio.*

### IDs, flags e status

- [ ] **IDs auxiliares inteiros** se preenchidos · **error**  
  *Ex.:* `laboratorio=LAB01` ou `subgrupo=1.5`.

- [ ] **flags opcionais `S` ou `N`** (`st`, `isento`, `semincidencia`, `usocontinuo`, `medfciapop`) · **error**  
  *Ex.:* `st=SIM`, `usocontinuo=1`.

- [ ] **`ativo`** = `A` ou `I` · **error**  
  *Ex.:* `ativo=S` ou `ativo=1`.

### Descontos e Farmácia Popular

- [ ] **`descontofixo` > `descontomax`** · **warning**  
  *Ex.:* `descontofixo=15` e `descontomax=10` → aviso.  
  *Ok:* `15` e `15` (igual não avisa); ou fixo menor que o máximo.

- [ ] **`medfciapop = S`** → `qtdfciapop` e `valorfciapop` obrigatórios · **error**  
  *Ex.:* `medfciapop=S` com `qtdfciapop` e/ou `valorfciapop` vazios.

### Controlados

- [ ] **DCB resolvível** (auxiliar **ou** banco TMS **ou** Anvisa); senão **anula controlado** · **warning**  
  *Ex.:* `listacontrole=A1`, `dcb=10021`, `registroms=…` e o `10021` não existe em nenhuma fonte → limpa lista/DCB/MS e avisa “controlado anulado”.

- [ ] **`registroms` obrigatório** quando o controlado é mantido · **error**  
  *Ex.:* `listacontrole=B1`, `dcb=4` (DCB ok), `registroms` vazio.

- [ ] **refs auxiliares existentes** · **error**  
  *Ex.:* `categoria=50` e `categoria.csv` não tem id `50`.

---

## Ajustes automáticos na validação

Além de reportar problemas, a validação pode **alterar a linha**:

| Ajuste | Exemplo |
|--------|---------|
| Recalcula `markup` | `custo=10`, `venda=15`, markup vazio → `markup=50,00` + warning |
| Anula controlado | DCB `10021` não encontrado → limpa `listacontrole` / `dcb` / `registroms` + warning |
| Cria coluna `markup` | CSV sem coluna markup, mas custo/venda permitem cálculo → coluna passa a existir nas linhas validadas |
