import React from 'react'
import type { Plan, PlanStep } from '@bugiganga/types'

interface PlanExecutionPanelProps {
  plan: Plan
}

function StepIcon({ status }: { status: PlanStep['status'] }) {
  if (status === 'completed') {
    return (
      <div className="plan-step__icon plan-step--completed">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  if (status === 'running') {
    return (
      <div className="plan-step__icon plan-step--running">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
          <circle cx="5" cy="5" r="2" />
        </svg>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="plan-step__icon plan-step--failed">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M3 3l4 4M7 3l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  return (
    <div className="plan-step__icon plan-step--pending">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </div>
  )
}

export function PlanExecutionPanel({ plan }: PlanExecutionPanelProps) {
  return (
    <div className="plan-panel">
      <div className="plan-panel__header">
        <span>Execution Plan</span>
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          {plan.steps.filter((s) => s.status === 'completed').length}/{plan.steps.length}
        </span>
      </div>
      <div className="plan-panel__steps">
        {plan.steps.map((step) => (
          <div
            key={step.id}
            className={`plan-step plan-step--${step.status}`}
          >
            <StepIcon status={step.status} />
            <span className="plan-step__desc">{step.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
