import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WizardStep } from '@/types'

const STEPS = [
  { id: 'connection' as WizardStep, number: '01', label: 'Conexão' },
  { id: 'file' as WizardStep, number: '02', label: 'Arquivo' },
  { id: 'mapping' as WizardStep, number: '03', label: 'Mapeamento' },
  { id: 'review' as WizardStep, number: '04', label: 'Revisão' },
  { id: 'import' as WizardStep, number: '05', label: 'Importação' },
]

interface StepperProps {
  currentStep: WizardStep
}

export function Stepper({ currentStep }: StepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isUpcoming = index > currentIndex

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-accent text-primary',
                    isUpcoming && 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : step.number}
                </div>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium',
                    isCurrent ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 mb-6 h-0.5 flex-1',
                    index < currentIndex ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
