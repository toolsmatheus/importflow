import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Toaster } from 'sonner'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-64">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}
