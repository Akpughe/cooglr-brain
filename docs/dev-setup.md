# Development Setup

## Prerequisites
- Node.js 18+
- SSH access to the OpenClaw server (ubuntu@3.123.22.254)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.local.example .env.local

# 3. Start SSH tunnel to OpenClaw gateway
ssh -N -L 18789:127.0.0.1:18789 ubuntu@3.123.22.254 &

# 4. Start dev server
npm run dev
```

## OpenClaw Gateway Tunnel

The Next.js app connects to OpenClaw via a WebSocket tunnel. The gateway runs on the remote server at `127.0.0.1:18789` (loopback only). The SSH tunnel forwards your local port to it:

```bash
ssh -N -L 18789:127.0.0.1:18789 ubuntu@3.123.22.254 &
```

This must be running before `npm run dev`.

To verify the tunnel is working:
```bash
curl -i http://127.0.0.1:18789/
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same location |
| `SUPABASE_SERVICE_ROLE_KEY` | Same location (keep secret!) |
| `OPENCLAW_GATEWAY_TOKEN` | From `~/.openclaw/openclaw.json` on server |
| `CREDENTIAL_ENCRYPTION_KEY` | Generate with: `openssl rand -hex 32` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App settings |
| `GOOGLE_CLIENT_ID` | Google Cloud Console |

## Database Migrations

Migrations are in `supabase/migrations/`. To apply:
- Use the Supabase Dashboard SQL Editor, or
- `npx supabase db push` (requires linking the project first)

## Project Structure

```
src/
  app/
    (auth)/         # Login, OAuth callback
    (dashboard)/    # Main app (chat, settings, admin)
    api/            # API routes (gateway proxy, accounts, admin)
  lib/
    supabase/       # Supabase client factories
    gateway/        # OpenClaw WebSocket protocol
    crypto.ts       # AES-256-GCM encryption for tokens
    constants.ts    # Shared constants
  components/
    chat/           # Chat interface
    admin/          # User management
    settings/       # Account connections
    auth/           # Login form
  hooks/            # React hooks (useGateway, useUser)
  types/            # TypeScript type definitions
```
