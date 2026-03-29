import React from 'react'

interface QuickActionsProps {
  onAction: (action: string) => void
  disabled?: boolean
}

const ACTIONS = [
  {
    id: 'summarize',
    label: 'Resumir',
    icon: (
      <svg viewBox="0 0 13 13" fill="none">
        <path d="M2 3h9M2 6h7M2 9h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'contacts',
    label: 'Contatos',
    icon: (
      <svg viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="4" r="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1.5 11c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'fill_form',
    label: 'Formulário',
    icon: (
      <svg viewBox="0 0 13 13" fill="none">
        <rect x="1" y="2" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 6h5M4 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
]

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="quick-actions">
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          className="quick-action-btn"
          onClick={() => onAction(action.id)}
          disabled={disabled}
          title={action.label}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  )
}
