-- Modelo SQL → CSV ImportFlow (produtos)
-- Delimitador do CSV: ;  |  Decimais: 10,50  |  Flags: S/N  |  Ativo: A/I
-- Substitua a tabela/colunas de origem e exporte com ; como separador.

SELECT
  -- ===== OBRIGATÓRIOS =====
  CAST(p.codigo AS varchar(30)) AS codigo,                 -- codigo_migracao; só dígitos; NÃO repetir
  CAST(p.nome AS varchar(120)) AS nome,                    -- não vazio; não só números
  CAST(p.codigogrupo AS varchar(20)) AS codigogrupo,       -- id do grupo.csv (auxiliar)
  REPLACE(CAST(p.custo AS varchar(30)), '.', ',') AS custo,
  REPLACE(CAST(p.venda AS varchar(30)), '.', ',') AS venda,
  CAST(COALESCE(p.fator, 1) AS varchar(10)) AS fator,
  CAST(p.listapiscofins AS varchar(20)) AS listapiscofins, -- NEUTRA | POSITIVA | NEGATIVA
  REPLACE(CAST(p.aliquota AS varchar(20)), '.', ',') AS aliquota,
  CAST(p.ncm AS varchar(20)) AS ncm,
  CAST(p.cstpiscofins AS varchar(10)) AS cstpiscofins,
  CAST(COALESCE(p.atualizaestoque, 'S') AS varchar(1)) AS atualizaestoque,   -- S/N
  CAST(COALESCE(p.atualizarpreco, 'S') AS varchar(1)) AS atualizarpreco,     -- S/N
  CAST(COALESCE(p.pagarpremicao, 'N') AS varchar(1)) AS pagarpremicao,       -- S/N
  CAST(COALESCE(p.permitedesconto, 'S') AS varchar(1)) AS permitedesconto,   -- S/N

  -- ===== OPCIONAIS =====
  REPLACE(CAST(p.markup AS varchar(30)), '.', ',') AS markup, -- se vazio, recalcula no ImportFlow
  '' AS cfop,                                                 -- deixe vazio: preenchido no envio
  REPLACE(CAST(p.valorpmc AS varchar(30)), '.', ',') AS valorpmc,
  CAST(p.codigobarras AS varchar(20)) AS codigobarras,        -- EAN 8/12/13/14
  CAST(p.codigoadicional AS varchar(200)) AS codigoadicional, -- EANs extras separados por ,
  CAST(p.subgrupo AS varchar(20)) AS subgrupo,                -- id do subgrupo.csv
  CAST(p.categoria AS varchar(20)) AS categoria,
  CAST(p.laboratorio AS varchar(20)) AS laboratorio,
  CAST(p.grupodepreco AS varchar(20)) AS grupodepreco,
  CAST(p.similar AS varchar(20)) AS similar,
  REPLACE(CAST(p.estoque AS varchar(30)), '.', ',') AS estoque,
  REPLACE(CAST(COALESCE(p.descontofixo, 0) AS varchar(30)), '.', ',') AS descontofixo,
  REPLACE(CAST(COALESCE(p.comissao, 0) AS varchar(30)), '.', ',') AS comissao,
  REPLACE(CAST(COALESCE(p.demanda, 0) AS varchar(30)), '.', ',') AS demanda,
  CAST(COALESCE(p.ativo, 'A') AS varchar(1)) AS ativo,        -- A/I
  CAST(COALESCE(p.st, 'N') AS varchar(1)) AS st,              -- S/N (obrigatório cruzar se aliquota=0)
  CAST(COALESCE(p.isento, 'N') AS varchar(1)) AS isento,      -- S/N (obrigatório cruzar se aliquota=0)
  CAST(COALESCE(p.semincidencia, 'N') AS varchar(1)) AS semincidencia,
  CAST(p.localizacao AS varchar(40)) AS localizacao,
  CAST(COALESCE(p.usocontinuo, 'N') AS varchar(1)) AS usocontinuo,
  CAST(p.observacao AS varchar(200)) AS observacao,
  REPLACE(CAST(COALESCE(p.descontomax, 10) AS varchar(30)), '.', ',') AS descontomax,
  CAST(p.cest AS varchar(20)) AS cest,
  CAST(p.csosn AS varchar(10)) AS csosn,
  CAST(p.csticms AS varchar(10)) AS csticms,

  -- ===== FARMÁCIA POPULAR =====
  CAST(COALESCE(p.medfciapop, 'N') AS varchar(1)) AS medfciapop, -- S → exige qtd/valor
  REPLACE(CAST(p.qtdfciapop AS varchar(30)), '.', ',') AS qtdfciapop,
  REPLACE(CAST(p.valorfciapop AS varchar(30)), '.', ',') AS valorfciapop,

  -- ===== CONTROLADOS =====
  CAST(p.listacontrole AS varchar(20)) AS listacontrole,
  CAST(p.dcb AS varchar(20)) AS dcb,                          -- id/código DCB auxiliar
  CAST(p.registroms AS varchar(20)) AS registroms,            -- obrigatório se controlado
  CAST(p.unidemb AS varchar(20)) AS unidemb,
  CAST(p.unidadesngpc AS varchar(20)) AS unidadesngpc

FROM sua_tabela_produtos p
-- WHERE ...
-- ORDER BY p.codigo
;
