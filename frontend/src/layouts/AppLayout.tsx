import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/useTheme'

export function AppLayout() {
  const { resolvedTheme } = useTheme()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pt-14 lg:pl-64 lg:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" richColors closeButton theme={resolvedTheme} />
    </div>
  )
}
