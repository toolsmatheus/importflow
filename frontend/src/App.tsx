import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/layouts/AppLayout'
import { ImportWizardProvider } from '@/hooks/useImportWizard'
import { ThemeProvider } from '@/hooks/useTheme'
import { ImportPage } from '@/pages/ImportPage'
import { ProductImportPage } from '@/pages/ProductImportPage'
import { OpcionaisImportPage } from '@/pages/OpcionaisImportPage'
import { FavorecidosImportPage } from '@/pages/FavorecidosImportPage'
import { FinanceiroImportPage } from '@/pages/FinanceiroImportPage'
import { SettingsPage } from '@/pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ImportWizardProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/import/produtos" replace />} />
                <Route path="/import" element={<ImportPage />}>
                  <Route index element={<Navigate to="produtos" replace />} />
                  <Route path="produtos" element={<ProductImportPage />} />
                  <Route path="opcionais" element={<OpcionaisImportPage />} />
                  <Route path="favorecidos" element={<FavorecidosImportPage />} />
                  <Route path="financeiro" element={<FinanceiroImportPage />} />
                </Route>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/import/produtos" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ImportWizardProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
