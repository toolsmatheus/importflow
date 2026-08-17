-- ImportFlow / toolspharma
-- Tabela de produtos usada como destino das importações.
-- Ajuste tipos e tamanhos conforme o banco de produção antes de usar.

-- CREATE DATABASE IF NOT EXISTS toolspharma
--   DEFAULT CHARACTER SET utf8mb4
--   DEFAULT COLLATE utf8mb4_unicode_ci;

USE toolspharma;

CREATE TABLE IF NOT EXISTS produtos (
  codigo            VARCHAR(20)   NOT NULL,
  nome              VARCHAR(120)  NOT NULL,
  codbarra          VARCHAR(14)   NULL,
  grupo             VARCHAR(60)   NULL,
  subgrupo          VARCHAR(60)   NULL,
  categoria         VARCHAR(60)   NULL,
  laboratorio       VARCHAR(80)   NULL,
  custo             DECIMAL(10,4) NOT NULL DEFAULT 0,
  margem            DECIMAL(10,4) NOT NULL DEFAULT 0,
  venda             DECIMAL(10,2) NOT NULL DEFAULT 0,
  estoque           DECIMAL(12,3) NOT NULL DEFAULT 0,
  demanda           DECIMAL(12,3) NOT NULL DEFAULT 0,
  descfixo          DECIMAL(5,2)  NOT NULL DEFAULT 0,
  descmax           DECIMAL(5,2)  NOT NULL DEFAULT 0,
  comfixo           DECIMAL(5,2)  NOT NULL DEFAULT 0,
  fator             DECIMAL(10,3) NOT NULL DEFAULT 1,
  ativo             TINYINT(1)    NOT NULL DEFAULT 1,
  atualizaestoque   TINYINT(1)    NOT NULL DEFAULT 1,
  suspendercompra   TINYINT(1)    NOT NULL DEFAULT 0,
  similar           TINYINT(1)    NOT NULL DEFAULT 0,
  permitedesconto   TINYINT(1)    NOT NULL DEFAULT 1,
  aliquotaicms      DECIMAL(5,2)  NOT NULL DEFAULT 0,
  st                TINYINT(1)    NOT NULL DEFAULT 0,
  isento            TINYINT(1)    NOT NULL DEFAULT 0,
  listacontrole     VARCHAR(20)   NULL,
  grupodepreco      VARCHAR(30)   NULL,
  localizacao       VARCHAR(30)   NULL,
  usocontinuo       TINYINT(1)    NOT NULL DEFAULT 0,
  observacao        VARCHAR(255)  NULL,
  medfp             TINYINT(1)    NOT NULL DEFAULT 0,
  qtdfp             DECIMAL(10,3) NOT NULL DEFAULT 0,
  regms             VARCHAR(20)   NULL,
  valorpmc          DECIMAL(10,2) NOT NULL DEFAULT 0,
  ncm               VARCHAR(8)    NULL,
  semincidencia     TINYINT(1)    NOT NULL DEFAULT 0,
  listapiscofins    VARCHAR(20)   NULL,
  cest              VARCHAR(7)    NULL,
  csticms           VARCHAR(3)    NULL,
  cstpiscofins      VARCHAR(2)    NULL,

  PRIMARY KEY (codigo),
  UNIQUE KEY uk_produtos_codbarra (codbarra),
  KEY idx_produtos_nome (nome),
  KEY idx_produtos_grupo (grupo, subgrupo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
