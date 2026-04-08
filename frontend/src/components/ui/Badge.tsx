import clsx from 'clsx'

const colorMap: Record<string, string> = {
  // Job statuses
  new: 'bg-info/10 text-info',
  saved: 'bg-accent/10 text-accent',
  contacts_found: 'bg-warning/10 text-warning',
  emailed: 'bg-gain/10 text-gain',
  // Legacy statuses
  interested: 'bg-accent/10 text-accent',
  contacted: 'bg-warning/10 text-warning',
  applied: 'bg-gain/10 text-gain',
  interview: 'bg-[#a855f7]/10 text-[#a855f7]',
  offer: 'bg-gain/10 text-gain',
  rejected: 'bg-loss/10 text-loss',
  expired: 'bg-text-tertiary/10 text-text-tertiary',
  // Email statuses
  draft: 'bg-info/10 text-info',
  approved: 'bg-warning/10 text-warning',
  sent: 'bg-gain/10 text-gain',
  replied: 'bg-accent/10 text-accent',
  failed: 'bg-loss/10 text-loss',
  // Sources
  greenhouse: 'bg-gain/10 text-gain',
  lever: 'bg-info/10 text-info',
  ashby: 'bg-accent/10 text-accent',
  workable: 'bg-warning/10 text-warning',
  smartrecruiters: 'bg-[#a855f7]/10 text-[#a855f7]',
  jobvite: 'bg-[#e97c2e]/10 text-[#e97c2e]',
  custom: 'bg-surface-3 text-text-secondary',
  ai_analysis: 'bg-[#a855f7]/10 text-[#a855f7]',
  web_search: 'bg-warning/10 text-warning',
  team_page: 'bg-info/10 text-info',
  // Application statuses
  ready: 'bg-warning/10 text-warning',
  withdrawn: 'bg-text-tertiary/10 text-text-tertiary',
  // Difficulty
  easy: 'bg-gain/10 text-gain',
  medium: 'bg-warning/10 text-warning',
  hard: 'bg-loss/10 text-loss',
  // Generic
  default: 'bg-surface-3 text-text-secondary',
}

interface BadgeProps {
  variant?: string
  className?: string
  children: React.ReactNode
  dot?: boolean
}

export default function Badge({ variant = 'default', className, children, dot }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-caption font-medium whitespace-nowrap',
        colorMap[variant] || colorMap.default,
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
