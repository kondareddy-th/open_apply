import { forwardRef, type InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import clsx from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-label text-text-secondary">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full bg-surface-1 text-text-primary text-body rounded-md border border-[rgba(255,255,255,0.06)]',
            'placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
            'transition-colors duration-150',
            icon ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
            error && 'border-loss/50',
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="text-caption text-loss">{error}</p>}
    </div>
  ),
)

Input.displayName = 'Input'

export function SearchInput(props: Omit<InputProps, 'icon'>) {
  return <Input icon={<Search className="w-4 h-4" />} placeholder="Search..." {...props} />
}

export default Input
