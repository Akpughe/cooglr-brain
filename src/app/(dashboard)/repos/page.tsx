import { RepoList } from "@/components/repos/repo-list";

export default function ReposPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Repositories</h1>
      <RepoList />
    </div>
  );
}
