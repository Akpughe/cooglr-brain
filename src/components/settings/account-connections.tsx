"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ExternalAccount } from "@/types/accounts";
import { OAUTH_PROVIDERS } from "@/types/accounts";

function ProviderIcon({ icon, name }: { icon: string; name: string }) {
  return (
    <div className="size-9 rounded-lg bg-muted border border-border/60 flex items-center justify-center text-xs font-semibold text-foreground/70 shrink-0">
      {icon}
    </div>
  );
}

export function AccountConnections() {
  const [accounts, setAccounts] = useState<ExternalAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      });
  }, []);

  function connect(provider: string) {
    window.location.href = `/api/accounts/connect?provider=${provider}`;
  }

  async function disconnect(provider: string) {
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    setAccounts((prev) => prev.filter((a) => a.provider !== provider));
  }

  const providers = Object.values(OAUTH_PROVIDERS);

  return (
    <Card className="rounded-xl shadow-warm">
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
        <CardDescription>
          Connect your personal accounts to use them with the AI assistant.
          Your credentials are encrypted and only used when you make requests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {providers.map((provider) => {
          const connected = accounts.find((a) => a.provider === provider.id);
          return (
            <div
              key={provider.id}
              className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ProviderIcon icon={provider.icon} name={provider.name} />
                <div>
                  <p className="font-medium text-sm">{provider.name}</p>
                  {connected ? (
                    <p className="text-xs text-muted-foreground">
                      {connected.provider_username || connected.provider_email}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connected && (
                  <Badge className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15">
                    Connected
                  </Badge>
                )}
                {connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnect(provider.id)}
                    className="rounded-lg"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connect(provider.id)}
                    disabled={loading}
                    className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
