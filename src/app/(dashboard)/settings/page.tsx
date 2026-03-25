import { AccountConnections } from "@/components/settings/account-connections";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AccountConnections />
    </div>
  );
}
