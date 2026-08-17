# ImportFlow

Ferramenta para importar dados de arquivos CSV para bancos MySQL.

## Estrutura

```
ImportFlow/
├── frontend/     # React + TypeScript + Vite
├── backend/      # Node.js + Fastify + TypeScript
└── data/         # Arquivos CSV de exemplo
```

## Pré-requisitos

- Node.js 20+
- npm

## Como executar

### Backend

```bash
cd backend
npm install
npm run dev
```

O backend inicia em `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend inicia em `http://localhost:5173`.

## Etapa atual

**Etapa 7:** Importação em lotes. `POST /api/import/start` devolve um `importId` na hora
(HTTP 202) e a gravação roda em background; o cliente acompanha por
`GET /api/import/status/:id` e busca `GET /api/import/:id/result` e
`GET /api/import/:id/errors` no final.

Como funciona a gravação:

- O CSV é lido em streaming e as linhas são agrupadas em lotes de 500, gravadas com um
  único comando por lote em vez de um comando por linha.
- Cada lote roda dentro de uma transação. Se o lote falhar, ele é desfeito e reprocessado
  linha por linha, para que as linhas boas entrem e o erro seja atribuído à linha exata.
- Linhas reprovadas na conversão de tipos não vão ao banco: entram no relatório de erros
  com linha, campo, valor e motivo.
- Os três modos: `insert` (só insere), `update` (só atualiza pela chave primária ou coluna
  única mapeada) e `upsert` (`INSERT ... ON DUPLICATE KEY UPDATE`).

A importação **não** é uma transação única do arquivo inteiro: os lotes já confirmados
permanecem no banco se a operação for interrompida. Isso evita travar a tabela e estourar
o log do MySQL em arquivos grandes.

## Ciclo de vida dos dados no servidor

Nada é persistido pelo ImportFlow. Credenciais e arquivos ficam apenas em memória e em
disco temporário, e são descartados assim que deixam de ser necessários:

| Dado | Onde fica | Quando é descartado |
|------|-----------|---------------------|
| Credenciais MySQL | memória do backend, por sessão | ao clicar em "Nova importação", ou após 2h sem uso |
| CSV enviado | `backend/temp/uploads/` | ao concluir a importação, ao trocar de arquivo, ao recomeçar, ou após 2h |
| Progresso e erros da importação | memória do backend | 1h após o término |

Em caso de falha o CSV é mantido, para permitir uma nova tentativa sem reenviar o arquivo.
Como o registro de arquivos vive em memória, o servidor limpa o diretório de uploads na
inicialização — qualquer arquivo remanescente é órfão de uma execução anterior.

**Etapa 6:** Validação e preview via `POST /api/import/validate`. O backend percorre o
CSV em streaming, converte cada valor de acordo com o tipo real da coluna no MySQL e
devolve o resumo (válidos / com alertas / inválidos), as primeiras ocorrências de
problema e um preview dos 10 primeiros registros já convertidos.

Regras aplicadas por tipo de coluna:

| Situação | Resultado |
|----------|-----------|
| Coluna `NOT NULL` sem default e não mapeada | erro bloqueante (impede a importação) |
| Valor vazio em coluna `NOT NULL` sem default | erro |
| Valor vazio em coluna `NOT NULL` com default | alerta, usa o default |
| Texto não numérico em coluna numérica | erro |
| Número acima da precisão/intervalo da coluna | erro |
| Casas decimais além do `scale` | alerta, arredonda |
| Texto maior que o tamanho da coluna | erro |
| Data fora de `DD/MM/AAAA` ou `AAAA-MM-DD` | erro |
| `Sim`/`N`/`true` em coluna `tinyint(1)` | alerta, converte para 0/1 |
| Valor fora das opções de um `ENUM` | erro |
| Valor repetido em coluna `PRIMARY`/`UNIQUE` | erro |

Números no formato brasileiro são aceitos: `1.234,56`, `8,90` e `R$ 12,50` são
convertidos corretamente.

## Dados de exemplo

| Arquivo | Descrição |
|---------|-----------|
| `data/schema-produtos.sql` | `CREATE TABLE produtos` no padrão toolspharma (39 colunas) |
| `data/products-example.csv` | 20 produtos, delimitador `;`, nomes de coluna no estilo de sistema legado |
| `data/products-invalid-example.csv` | 12 produtos com erros propositais para exercitar a validação |

Para preparar o banco de testes:

```bash
mysql -u root -p toolspharma < data/schema-produtos.sql
```

Os CSVs de exemplo usam `nome` no cabeçalho (mesmo nome da coluna no banco), então o
mapeamento automático acerta as 39 colunas sem ajuste manual.
