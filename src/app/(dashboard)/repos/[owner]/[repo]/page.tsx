import { RepoDetail } from "@/components/repos/repo-detail";

export default async function RepoDetailPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <RepoDetail owner={owner} repo={repo} />
    </div>
  );
}
