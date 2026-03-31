import { Github } from "lucide-react";

export default function GitHubReposPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Github className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">GitHub Repos</h1>
          <p className="text-muted-foreground text-sm max-w-xs">Repository management, PRs, and issues</p>
        </div>
      </div>
    </div>
  );
}
