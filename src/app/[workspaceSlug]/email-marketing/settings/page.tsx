"use client";

import { useWorkspace } from "@/lib/workspace/context";
import { EmailProviderSettings } from "@/components/settings/email-provider";

export default function EmailSettingsPage() {
  const { workspace } = useWorkspace();
  return (
    <div className="flex-1 overflow-y-auto">
      <EmailProviderSettings workspaceId={workspace.id} />
    </div>
  );
}
