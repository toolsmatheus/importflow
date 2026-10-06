import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Badge } from './Badge'
import { Card } from './Card'
import { Spinner } from './Spinner'
import { ToggleButton, ToggleGroup } from './ToggleGroup'

const meta = { title: 'Exibição/Componentes' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Badges: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="positive">▲ +2,1 p.p.</Badge>
      <Badge variant="negative">▼ −1,4 p.p.</Badge>
      <Badge>= estável</Badge>
    </div>
  ),
}

export const Cards: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      <Card variant="panel">panel: seção de página</Card>
      <Card variant="flat">flat: cartão dentro de um painel</Card>
      <Card variant="inset">inset: mini-cartão de destaque</Card>
    </div>
  ),
}

function AlternanciaDemo() {
  const [valor, setValor] = useState('produto')
  return (
    <ToggleGroup role="group" aria-label="Agrupar por">
      {[
        ['produto', 'Grupo de produto'],
        ['canal', 'Canal de venda'],
      ].map(([chave, rotulo]) => (
        <ToggleButton key={chave} ativo={valor === chave} aria-pressed={valor === chave} onClick={() => setValor(chave)}>
          {rotulo}
        </ToggleButton>
      ))}
    </ToggleGroup>
  )
}

export const Alternancia: Story = { render: () => <AlternanciaDemo /> }

export const Spinners: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner />
      <Spinner size="lg" />
    </div>
  ),
}
