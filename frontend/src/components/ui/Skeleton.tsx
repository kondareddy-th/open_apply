import clsx from 'clsx'

interface SkeletonProps {
  className?: string
}

export default function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('skeleton rounded-md', className)} />
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={clsx('bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)] space-y-3', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}
