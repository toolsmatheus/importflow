import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './Input'
import { Select } from './Select'

const meta = {
  title: 'Formulário/Campos',
  component: Input,
  decorators: [(Story) => <div className="w-64">{Story()}</div>],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Texto: Story = { args: { placeholder: 'Digite aqui', 'aria-label': 'Campo de texto' } }
export const Desabilitado: Story = { args: { disabled: true, value: 'Somente leitura', 'aria-label': 'Campo desabilitado' } }

export const ComSelect: Story = {
  render: () => (
    <Select aria-label="Mês" defaultValue="2">
      <option value="1">Janeiro</option>
      <option value="2">Fevereiro</option>
      <option value="3">Março</option>
    </Select>
  ),
}
