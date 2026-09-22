import { cn } from '@/lib/utils'
import { WIZARD_STEP_LABELS, WIZARD_STEPS } from '@/hooks/useImportWizard'
import type { WizardStep } from '@/types'
import type { ReactNode } from 'react'

interface StepperProps {
  currentStep: WizardStep
  /** Ação à direita do rótulo (ex.: Reiniciar). */
  action?: ReactNode
}

export function Stepper({ currentStep, action }: StepperProps) {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep)
  const total = WIZARD_STEPS.length

  return (
    <nav aria-label="Etapas" className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {currentIndex + 1}/{total} · {WIZARD_STEP_LABELS[currentStep]}
        </p>
        {action}
      </div>
      <div className="flex gap-1" role="list">
        {WIZARD_STEPS.map((stepId, index) => (
          <div
            key={stepId}
            role="listitem"
            aria-current={index === currentIndex ? 'step' : undefined}
            title={WIZARD_STEP_LABELS[stepId]}
            className={cn(
              'h-1 flex-1 rounded-full',
              index <= currentIndex ? 'bg-primary' : 'bg-border'
            )}
          />
        ))}
      </div>
    </nav>
  )
}
