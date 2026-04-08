import clsx from 'clsx'
import Button from './Button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 px-4', className)}>
      {icon && <div className="text-text-tertiary mb-3">{icon}</div>}
      <h3 className="text-heading text-text-primary mb-1">{title}</h3>
      {description && <p className="text-body text-text-tertiary text-center max-w-sm">{description}</p>}
      {action && (
        <Button variant="accent" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
