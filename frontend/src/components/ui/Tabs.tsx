import clsx from 'clsx'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export default function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={clsx('flex gap-1 p-1 bg-surface-1 rounded-lg', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-3 py-1.5 rounded-md text-label transition-all duration-150',
            active === tab.id
              ? 'bg-surface-3 text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-secondary',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={clsx(
              'ml-1.5 text-caption',
              active === tab.id ? 'text-text-secondary' : 'text-text-tertiary',
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
