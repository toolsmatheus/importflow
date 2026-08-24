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
    <div className="mb-4">
      <p className="mb-2 text-sm text-muted-foreground lg:hidden">
        {currentIndex + 1}/{WIZARD_STEPS.length} · {WIZARD_STEP_LABELS[currentStep]}
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
                    'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-accent text-primary',
                    isUpcoming && 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-center text-xs',
                    isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {WIZARD_STEP_LABELS[stepId]}
                </span>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 mb-5 h-px flex-1',
                    index < currentIndex ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-1 lg:hidden">
        {WIZARD_STEPS.map((stepId, index) => (
          <div
            key={stepId}
            className={cn(
              'h-1 flex-1 rounded-full',
              index <= currentIndex ? 'bg-primary' : 'bg-border'
            )}
            title={WIZARD_STEP_LABELS[stepId]}
          />
        ))}
      </div>
    </div>
  )
}
