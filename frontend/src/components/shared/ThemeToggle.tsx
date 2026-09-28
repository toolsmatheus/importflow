import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme, type Theme } from '@/hooks/useTheme'

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

interface ThemeToggleProps {
  compact?: boolean
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  if (compact) {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    const current = options.find((option) => option.value === theme) ?? options[0]
    const Icon = current.icon

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        onClick={() => setTheme(next)}
        title={`Tema: ${current.label}. Clique para alterar.`}
        aria-label={`Tema atual: ${current.label}`}
      >
        <Icon className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(({ value, label, icon: Icon }) => {
        const selected = theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm font-medium transition-colors',
              selected
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            aria-pressed={selected}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
