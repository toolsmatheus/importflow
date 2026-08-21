import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WIZARD_STEP_LABELS, WIZARD_STEPS } from '@/hooks/useImportWizard'
import type { WizardStep } from '@/types'

interface StepperProps {
  currentStep: WizardStep
}

export function Stepper({ currentStep }: StepperProps) {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep)

  return (
    <div className="mb-8">
      <p className="mb-3 text-sm text-muted-foreground lg:hidden">
        Etapa {currentIndex + 1} de {WIZARD_STEPS.length}:{' '}
        <span className="font-medium text-foreground">{WIZARD_STEP_LABELS[currentStep]}</span>
      </p>

      <div className="hidden items-center justify-between lg:flex">
        {WIZARD_STEPS.map((stepId, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isUpcoming = index > currentIndex

          return (
            <div key={stepId} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-accent text-primary',
                    isUpcoming && 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : String(index + 1).padStart(2, '0')}
                </div>
                <span
                  className={cn(
                    'mt-2 text-center text-xs font-medium',
                    isCurrent ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {WIZARD_STEP_LABELS[stepId]}
                </span>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
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

      <div className="flex gap-1.5 lg:hidden">
        {WIZARD_STEPS.map((stepId, index) => (
          <div
            key={stepId}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              index <= currentIndex ? 'bg-primary' : 'bg-border'
            )}
            title={WIZARD_STEP_LABELS[stepId]}
          />
        ))}
      </div>
    </div>
  )
}
