export interface ExternalAccount {
  id: string;
  provider: string;
  provider_email: string | null;
  provider_username: string | null;
  scopes: string[] | null;
  connected_at: string;
}

export const OAUTH_PROVIDERS: Record<string, {
  id: string;
  name: string;
  icon: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}> = {
  github: {
    id: "github",
    name: "GitHub",
    icon: "GH",
    scopes: ["repo", "read:user", "user:email"],
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
  },
  google: {
    id: "google",
    name: "Google Workspace",
    icon: "G",
    scopes: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  },
};
