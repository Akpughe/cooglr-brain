import { AccountConnections } from "@/components/settings/account-connections";
import { DbConnections } from "@/components/settings/db-connections";
import { EmailProviderSettings } from "@/components/settings/email-provider";

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your integrations and data connections</p>
        </div>
        <AccountConnections />
        <DbConnections />
        <EmailProviderSettings />
      </div>
    </div>
  );
}
