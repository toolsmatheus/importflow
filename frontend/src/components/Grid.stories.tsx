import type { Meta, StoryObj } from '@storybook/react-vite'
import { Grid, GridCell, GridTh } from './Grid'

const meta = { title: 'Dados/Grid', component: Grid } satisfies Meta<typeof Grid>

export default meta
type Story = StoryObj<typeof meta>

export const RelatorioComLinhas: Story = {
  render: () => (
    <div className="w-[36rem] rounded-lg border border-line bg-surface p-4">
      <Grid>
        <thead>
          <tr>
            <GridTh>Conta</GridTh>
            <GridTh align="right">Valor (R$)</GridTh>
            <GridTh align="right">% RL</GridTh>
          </tr>
        </thead>
        <tbody>
          <tr className="rubrica-row expandable" tabIndex={0}>
            <td>
              <span className="glyph">▸</span>
              Receita Bruta
            </td>
            <td className="valor">120.000,00</td>
            <td className="valor text-fg-subtle">115,4%</td>
          </tr>
          <tr className="detail-row">
            <td>Vendas balcão</td>
            <td className="valor">80.000,00</td>
            <td className="valor text-fg-subtle">76,9%</td>
          </tr>
          <tr className="rubrica-row">
            <td>(-) Deduções</td>
            <td className="valor">-16.000,00</td>
            <td className="valor text-fg-subtle">-15,4%</td>
          </tr>
          <tr className="subtotal-row">
            <td>Receita Líquida</td>
            <td className="valor">104.000,00</td>
            <td className="valor">100,0%</td>
          </tr>
        </tbody>
      </Grid>
    </div>
  ),
}

export const ComCelulas: Story = {
  render: () => (
    <Grid>
      <thead>
        <tr>
          <GridTh>Dia</GridTh>
          <GridTh align="right">Entradas</GridTh>
          <GridTh align="right">Saldo</GridTh>
        </tr>
      </thead>
      <tbody>
        <tr className="dia-row">
          <GridCell>01/10/2026</GridCell>
          <GridCell align="right">1.250,00</GridCell>
          <GridCell align="right" className="font-semibold">
            4.800,00
          </GridCell>
        </tr>
        <tr className="dia-row">
          <GridCell tone="faint">02/10/2026 (previsto)</GridCell>
          <GridCell align="right" tone="faint">
            900,00
          </GridCell>
          <GridCell align="right" tone="faint">
            5.700,00
          </GridCell>
        </tr>
      </tbody>
    </Grid>
  ),
}
