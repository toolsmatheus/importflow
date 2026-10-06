import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'

const meta = {
  title: 'Ações/Button',
  component: Button,
  args: { children: 'Exportar para Excel' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'danger', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'icon'] },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = { args: { variant: 'primary' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Cancelar' } }
export const Danger: Story = { args: { variant: 'danger', children: 'Tentar novamente' } }
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ver detalhes' } }
export const Small: Story = { args: { size: 'sm', children: 'Compacto' } }
export const Icon: Story = { args: { variant: 'secondary', size: 'icon', children: '‹', 'aria-label': 'Mês anterior' } }
export const ComIcone: Story = {
  args: {
    children: (
      <>
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="3" width="16" height="14" rx="1.5" />
          <line x1="2" y1="8" x2="18" y2="8" />
          <line x1="2" y1="13" x2="18" y2="13" />
          <line x1="8" y1="3" x2="8" y2="17" />
        </svg>
        <span>Exportar para Excel</span>
      </>
    ),
  },
}
export const Disabled: Story = { args: { disabled: true } }
