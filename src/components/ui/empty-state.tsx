import type { ReactNode } from "react"

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  "data-testid"?: string
}

export function EmptyState({ icon, title, description, action, compact, ...rest }: EmptyStateProps) {
  if (compact) {
    return (
      <div data-testid={rest["data-testid"]} className="flex items-center gap-2 px-2 py-2 text-muted-foreground">
        <div className="opacity-40 [&>svg]:size-4">{icon}</div>
        <span className="text-xs">{title}</span>
      </div>
    )
  }
  return (
    <div data-testid={rest["data-testid"]} className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 opacity-50 [&>svg]:size-10">{icon}</div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
