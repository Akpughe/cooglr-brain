import { GitBranch } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function GitHubReposPage() {
  return (
    <EmptyState
      icon={GitBranch}
      title="GitHub Repos"
      description="Repository management, PRs, and issues coming soon."
    />
  );
}
