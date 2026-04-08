import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import clsx from 'clsx'

interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
}

export default function Dropdown({ options, value, onChange, placeholder = 'Select...', className, size = 'md' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex items-center justify-between w-full bg-surface-1 text-left rounded-md border border-[rgba(255,255,255,0.06)]',
          'hover:border-[rgba(255,255,255,0.1)] transition-colors',
          size === 'sm' ? 'px-2.5 py-1.5 text-caption' : 'px-3 py-2 text-body',
        )}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-tertiary'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={clsx('w-3.5 h-3.5 text-text-tertiary transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-2 rounded-md border border-[rgba(255,255,255,0.08)] shadow-xl py-1 max-h-60 overflow-y-auto animate-fade-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={clsx(
                'flex items-center justify-between w-full px-3 py-1.5 text-body transition-colors',
                opt.value === value
                  ? 'text-accent bg-accent/5'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]',
              )}
            >
              {opt.label}
              {opt.value === value && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
