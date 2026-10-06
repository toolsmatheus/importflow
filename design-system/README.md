# ToolsPharma Design System

Design tokens e ativos de marca extraídos de `MANUAL_DE_MARCA_-_TOOLSPHARMA.pdf`, empacotados para
reuso em qualquer aplicação (não depende do Tailwind nem deste repositório).

## Conteúdo

```
design-system/
  tokens.json          # fonte única da verdade — cores, tipografia, espaçamento, raios, regras de logo
  tokens.css           # os mesmos tokens como CSS custom properties (var(--tp-color-primary-500))
  tailwind-theme.css   # mapeamento pronto para @theme do Tailwind v4
  fonts.css            # @import das 4 famílias tipográficas via Google Fonts
  logo/                # símbolo, wordmark e lockups em 3 variantes (color/white/blackink), PNG com transparência
```

## Como usar

**Em qualquer app (HTML/CSS puro, Vue, Angular, etc.):**
```html
<link rel="stylesheet" href="design-system/fonts.css">
<link rel="stylesheet" href="design-system/tokens.css">
```
```css
.botao-primario {
  background: var(--tp-color-primary-500);
  font-family: var(--tp-font-body);
  border-radius: var(--tp-radius-md);
}
```

**Em um app Tailwind v4 (como este frontend):**
```css
@import "tailwindcss";
@import "../../design-system/fonts.css";
@import "../../design-system/tailwind-theme.css";
```
Depois use as classes normalmente: `bg-primary-500`, `text-neutral-800`, `font-display`, `rounded-lg`.

## Cores

| Token de marca | Hex | Pantone | Papel |
|---|---|---|---|
| Firefly | `#12353B` | 7477 C | texto principal / fundo escuro / ponta escura do gradiente |
| Genoa | `#157572` | 7717 C | ação primária (hover/pressed) |
| Robin's Egg Blue | `#00C7D4` | 7466 C | ação primária (cor de destaque principal) |
| Cutty Sark | `#4E7A78` | 5483 C | texto secundário, ícones |
| Plantation | `#234544` | 626 C | fundo escuro alternativo |
| Jade | `#00A972` | 339 C | sucesso / positivo |
| Magic Mint | `#8CEEB4` | 7478 C | destaque leve, badges |
| Gradiente | `#12353B → #009FA9` | — | heros, botões de destaque, splash — sempre do escuro para o claro, 60° |

As escalas `primary-*` / `success-*` / `neutral-*` em `tokens.css` são derivadas por interpolação a
partir desses hex oficiais (ver `tokens.json.color.note` para os pontos-âncora exatos). `negative-*`
e `warning-*` são tokens técnicos de sistema — o manual de marca não define cores de erro/aviso.

## Tipografia

| Papel | Fonte | Quando usar |
|---|---|---|
| `--tp-font-display` | Bebas Neue | títulos grandes, hero, números de destaque |
| `--tp-font-body` | DM Sans | UI, texto de interface, botões, labels |
| `--tp-font-data` | Roboto | tabelas densas, dados tabulares/financeiros |
| `--tp-font-editorial` | DM Serif Display | destaques editoriais, citações |

Todas disponíveis no Google Fonts; `fonts.css` já importa os pesos usados no manual.

## Logo

- Símbolo: hexágono com o monograma **"tp"**. Wordmark: **toolspharma** minúsculo, com "pharma" em peso
  mais forte que "tools".
- Margem de segurança: altura da letra "t" do símbolo, em todos os lados.
- Tamanho mínimo: símbolo isolado 1,5 cm · assinatura horizontal 2 cm.
- Nunca: recolorir fora da paleta, distorcer/esticar, aplicar sobre fundo de baixo contraste, ou usar
  abaixo do tamanho mínimo.
- Variantes disponíveis em `logo/`: `color` (cores da marca), `white` (negativo, para fundos escuros/
  gradiente) e `blackink` (tinta única, para aplicações de baixo contraste de cor).
- Composições: `symbol` (só o hexágono), `wordmark` (só o texto), `lockup-horizontal` (símbolo + texto
  lado a lado — auxiliar) e `lockup-vertical` (símbolo sobre o texto — assinatura principal/prioritária).

**Nota de qualidade**: os PNGs em `logo/` foram recortados das páginas do manual (rasterizadas a
300dpi) porque o PDF fornecido só contém as páginas como imagens flatten (sem paths vetoriais). São
adequados para uso em tela (headers, favicons, botões) em tamanhos moderados. Para impressão ou uso
em alta resolução, solicite os arquivos vetoriais originais (AI/EPS/SVG) de quem produziu o manual.

## Aplicação neste repositório

O frontend importa `fonts.css` e `tailwind-theme.css` (tokens primitivos da marca). Em cima deles,
`frontend/src/design-system/` define os tokens **semânticos** (texto, borda, ação, estados) e os
componentes base (Button, Input, Select, Toggle, Badge, Card, Spinner). Regras de uso e catálogo:
`frontend/DESIGN.md` e `npm run storybook` (em `frontend/`).
