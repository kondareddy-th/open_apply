import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

const variants = {
  primary: 'bg-accent text-base hover:bg-accent-hover',
  secondary: 'bg-surface-3 text-text-primary hover:bg-surface-4 border border-[rgba(255,255,255,0.06)]',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
  destructive: 'bg-loss/10 text-loss hover:bg-loss/20',
  accent: 'bg-accent/10 text-accent hover:bg-accent/20',
}

const sizes = {
  sm: 'px-2.5 py-1.5 text-caption gap-1.5',
  md: 'px-3.5 py-2 text-body gap-2',
  lg: 'px-5 py-2.5 text-heading gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  icon?: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 press-scale',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
)

Button.displayName = 'Button'
export default Button
