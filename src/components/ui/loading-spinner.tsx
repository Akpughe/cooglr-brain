import { cn } from "@/lib/utils"

type LoadingSpinnerProps = React.ComponentProps<"div"> & {
  size?: "sm" | "md" | "lg"
  label?: string
}

const sizeClasses = {
  sm: "size-4 border-[1.5px]",
  md: "size-6 border-2",
  lg: "size-8 border-2",
} as const

function LoadingSpinner({
  size = "md",
  label,
  className,
  ...props
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      {...props}
    >
      <div
        className={cn(
          "animate-spin rounded-full border-muted-foreground/20 border-t-muted-foreground/60",
          sizeClasses[size]
        )}
      />
      {label && (
        <p className="text-sm text-muted-foreground">{label}</p>
      )}
      <span className="sr-only">{label || "Loading..."}</span>
    </div>
  )
}

function PageLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  )
}

export { LoadingSpinner, PageLoading }
