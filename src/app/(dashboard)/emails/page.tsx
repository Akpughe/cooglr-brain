"use client";

import { useState } from "react";
import { EmailComposer } from "@/components/emails/email-composer";
import { EmailHistory } from "@/components/emails/email-history";

export default function EmailsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Emails</h1>
      <EmailComposer onSent={() => setRefreshKey((k) => k + 1)} />
      <EmailHistory refreshKey={refreshKey} />
    </div>
  );
}
