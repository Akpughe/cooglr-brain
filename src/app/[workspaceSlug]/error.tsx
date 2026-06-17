"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { useParams } from "next/navigation";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ workspaceSlug: string }>();

  useEffect(() => {
    console.error("Workspace error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          We couldn&apos;t load this page. This might be a temporary issue.
        </p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="size-4" />
          Try again
        </button>
        <a
          href={`/${params.workspaceSlug}`}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Home className="size-4" />
          Back to home
        </a>
      </div>
    </div>
  );
}
