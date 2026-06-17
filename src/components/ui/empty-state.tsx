import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type EmptyStateProps = React.ComponentProps<"div"> & {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-xl font-semibold">{title}</h3>
        {description && (
          <p className="max-w-xs text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
