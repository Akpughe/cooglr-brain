"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { EmailOnboarding } from "@/components/emails/email-onboarding";

export default function EmailMarketingPage() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Check if provider exists
    fetch(`/api/emails/providers?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => {
        const providers = Array.isArray(data) ? data : (data.providers || []);
        if (providers.length === 0) {
          setNeedsOnboarding(true);
        } else {
          // Provider exists — go straight to campaigns
          router.replace(`/${workspace.slug}/email-marketing/campaigns`);
        }
        setLoading(false);
      })
      .catch(() => {
        setNeedsOnboarding(true);
        setLoading(false);
      });
  }, [workspace.id, workspace.slug, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <EmailOnboarding
        workspaceId={workspace.id}
        onComplete={() => router.push(`/${workspace.slug}/email-marketing/campaigns`)}
      />
    );
  }

  return null;
}
