import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LayoutApp } from '@/layouts/LayoutApp'
import { ProvedorAssistenteImportacao } from '@/features/produtos/useAssistenteImportacao'
import { PaginaImportacao } from '@/features/produtos/PaginaImportacao'
import { PaginaImportacaoProduto } from '@/features/produtos/PaginaImportacaoProduto'
import { OpcionaisImportPage } from '@/features/opcionais/OpcionaisImportPage'
import { PaginaConfiguracoes } from '@/features/configuracoes/PaginaConfiguracoes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProvedorAssistenteImportacao>
        <BrowserRouter>
          <Routes>
            <Route element={<LayoutApp />}>
              <Route path="/" element={<Navigate to="/import/produtos" replace />} />
              <Route path="/import" element={<PaginaImportacao />}>
                <Route index element={<Navigate to="produtos" replace />} />
                <Route path="produtos" element={<PaginaImportacaoProduto />} />
                <Route path="opcionais" element={<OpcionaisImportPage />} />
              </Route>
              <Route path="/settings" element={<PaginaConfiguracoes />} />
              <Route path="*" element={<Navigate to="/import/produtos" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProvedorAssistenteImportacao>
    </QueryClientProvider>
  )
}

export default App
