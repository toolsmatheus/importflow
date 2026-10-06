import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Sidebar, SidebarAba, SidebarBrand, SidebarBrandNome, SidebarItem, SidebarNav } from './Sidebar'

const meta = { title: 'Navegação/Sidebar', parameters: { layout: 'fullscreen' } } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function Icone() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="2.5" width="14" height="15" rx="1.5" />
      <line x1="6" y1="6.5" x2="14" y2="6.5" />
      <line x1="6" y1="10" x2="14" y2="10" />
    </svg>
  )
}

function IconeSair() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 3.5H4.5A1.5 1.5 0 0 0 3 5v10a1.5 1.5 0 0 0 1.5 1.5H8" />
      <polyline points="12,6.5 15.5,10 12,13.5" />
      <line x1="15.5" y1="10" x2="7.5" y2="10" />
    </svg>
  )
}

function SidebarDemo({ inicial }: { inicial: boolean }) {
  const [recolhida, setRecolhida] = useState(inicial)
  const [ativo, setAtivo] = useState('relatorio')
  return (
    <div className="relative h-96 w-fit">
      <Sidebar recolhida={recolhida}>
        <SidebarBrand>
          <SidebarBrandNome>Plataforma DRE</SidebarBrandNome>
        </SidebarBrand>
        <SidebarNav>
          {[
            ['relatorio', 'Relatório'],
            ['dfc', 'DFC Diário'],
          ].map(([chave, rotulo]) => (
            <SidebarItem key={chave} ativo={ativo === chave} aria-label={rotulo} icone={<Icone />} onClick={() => setAtivo(chave)}>
              {rotulo}
            </SidebarItem>
          ))}
        </SidebarNav>
        <SidebarItem className="mt-auto" aria-label="Sair" icone={<IconeSair />}>
          Sair
        </SidebarItem>
      </Sidebar>
      <SidebarAba
        recolhida={recolhida}
        aria-label={recolhida ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        onClick={() => setRecolhida((r) => !r)}
      />
    </div>
  )
}

export const Expandida: Story = { render: () => <SidebarDemo inicial={false} /> }
export const Recolhida: Story = { render: () => <SidebarDemo inicial /> }
