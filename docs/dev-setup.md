# Development Setup

## Prerequisites
- Node.js 22+
- Tailscale installed and connected to the team network

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env.local

# 3. Start dev server
npm run dev
```

## OpenClaw Gateway Connection

The app connects to OpenClaw via WebSocket over the Tailscale private network.

Set your `.env.local`:
```
OPENCLAW_GATEWAY_HOST=100.69.216.100
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_TOKEN=<token from server>
```

The gateway token is in `~/.openclaw/openclaw.json` on the server (`ubuntu@3.123.22.254`).

### Tailscale Setup
1. Install Tailscale: https://tailscale.com/download
2. Ask an admin to invite you to the team network
3. Once connected, the gateway IP `100.69.216.100` will be reachable

### Fallback: SSH Tunnel (if Tailscale unavailable)
```bash
ssh -N -L 18789:127.0.0.1:18789 ubuntu@3.123.22.254 &
```
Then use `OPENCLAW_GATEWAY_HOST=127.0.0.1` in `.env.local`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same location |
| `SUPABASE_SERVICE_ROLE_KEY` | Same location (keep secret!) |
| `OPENCLAW_GATEWAY_TOKEN` | `~/.openclaw/openclaw.json` on server |
| `CREDENTIAL_ENCRYPTION_KEY` | Generate with: `openssl rand -hex 32` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App settings |
| `GOOGLE_CLIENT_ID` | Google Cloud Console |
| `GEMINI_API_KEY` | Google AI Studio |
| `RESEND_WEBHOOK_SECRET` | Resend dashboard > Webhooks |

## Database Migrations

Migrations are in `supabase/migrations/`. To apply:
- Use the Supabase Dashboard SQL Editor, or
- `npx supabase db push` (requires linking the project first)

## Project Structure

```
src/
  app/
    (auth)/         # Login, OAuth callback
    (dashboard)/    # Main app pages
    api/            # API routes
  lib/
    supabase/       # Supabase client factories
    gateway/        # OpenClaw WebSocket protocol
    crypto.ts       # AES-256-GCM encryption
    db-adapter.ts   # PostgreSQL/MySQL/ClickHouse adapter
    github.ts       # GitHub API helpers
    google.ts       # Google API helpers (Sheets)
    tokens.ts       # OAuth token decryption
  components/
    chat/           # Chat interface
    dashboard/      # Dashboard widgets
    repos/          # GitHub repos/PRs/issues
    tickets/        # Ticket board
    reports/        # Report builder
    emails/         # Email marketing
    settings/       # Account/DB/email provider settings
    admin/          # User allowlist management
    auth/           # Login form
    layout/         # Sidebar
  hooks/            # React hooks (useGateway, useUser)
  types/            # TypeScript type definitions
```
