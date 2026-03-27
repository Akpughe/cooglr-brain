# 500Claw Platform — UI Redesign Spec

## Goal
Full visual redesign of the 500Claw platform from generic styling to a warm, approachable, premium SaaS experience with light/dark mode support.

## Design Philosophy
- **Warm & Approachable** — Earth tones, soft shadows, rounded corners. Feels human, not cold.
- **Simplicity (Gradual Revelation)** — One primary action per view. Progressive disclosure. Show only what matters now.
- **Fluidity** — No instant show/hide. Animate transitions. Shared elements morph between states.
- **Delight** — Selective emphasis. The orange accent draws attention only where it matters.

## Color System

### Light Mode (default)
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#faf8f5` | Page background |
| `--sidebar` | `#f5f2ed` | Sidebar background |
| `--card` | `#ffffff` | Card surfaces |
| `--border` | `#e7e0d5` | Borders, dividers |
| `--border-subtle` | `#f0ebe3` | Subtle separators |
| `--foreground` | `#292524` | Primary text (stone-900) |
| `--muted-foreground` | `#78716c` | Secondary text (stone-500) |
| `--muted` | `#a8a29e` | Tertiary text (stone-400) |
| `--accent` | `#c2410c` | Primary accent — burnt orange |
| `--accent-foreground` | `#ffffff` | Text on accent |
| `--accent-muted` | `#fff7ed` | Light orange background |
| `--ring` | `#c2410c33` | Focus ring |

### Dark Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#1c1917` | Page background (stone-900) |
| `--sidebar` | `#151311` | Sidebar background |
| `--card` | `#231f1c` | Card surfaces |
| `--border` | `#2e2a26` | Borders |
| `--border-subtle` | `#252220` | Subtle separators |
| `--foreground` | `#fafaf9` | Primary text (stone-50) |
| `--muted-foreground` | `#a8a29e` | Secondary text (stone-400) |
| `--muted` | `#78716c` | Tertiary text (stone-500) |
| `--accent` | `#ea580c` | Brighter orange for dark bg |
| `--accent-foreground` | `#ffffff` | Text on accent |
| `--accent-muted` | `#431407` | Dark orange background |
| `--ring` | `#ea580c33` | Focus ring |

### Status Colors (both modes)
| Status | Light | Dark |
|--------|-------|------|
| Success | `#16a34a` | `#22c55e` |
| Warning | `#d97706` | `#f59e0b` |
| Error | `#dc2626` | `#ef4444` |
| Info | `#2563eb` | `#3b82f6` |

## Typography
- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Base size:** 14px, line-height 1.6
- **Headings:** font-weight 600, letter-spacing -0.025em
- **Page titles:** 24px
- **Section titles:** 16px
- **Body:** 14px
- **Small/labels:** 12px, uppercase with letter-spacing 0.05em for section labels
- **Mono:** `'SF Mono', 'Fira Code', monospace` for code/SQL/data

## Border Radius
| Element | Radius |
|---------|--------|
| Cards, modals | 12px |
| Buttons, inputs | 8px |
| Chat bubbles (user) | 20px |
| Badges | 6px |
| Avatars | 50% |
| Sidebar items | 8px |

## Shadows
- **Card:** `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)`
- **Card hover:** `0 4px 12px rgba(0,0,0,0.06)`
- **Dropdown:** `0 4px 16px rgba(0,0,0,0.08)`
- **Dark mode:** same pattern but with `rgba(0,0,0,0.2)` base

## Layout

### Sidebar
- **Full width:** 240px on screens ≥1024px
- **Icon rail:** 56px on screens <1024px
- **Manual toggle:** button at bottom to collapse/expand regardless of screen size
- **Structure:**
  - Logo + app name (top)
  - Nav groups: General (Dashboard, Chat), Development (Repos, Tickets), Business (Reports, Emails), System (Settings, Admin)
  - Each group has uppercase label
  - Active item: white bg + subtle shadow (light), warm dark card (dark)
  - Hover: gentle background shift
  - User avatar + email (bottom)
  - Dark mode toggle (bottom, sun/moon icon)
- **Icon rail mode:** shows only icons, tooltip on hover for labels

### Content Area
- `flex-1`, `overflow-y-auto`
- Max-width varies by page: chat full-width, reports full-width, settings 768px centered, admin 960px centered

## Chat (Hybrid Style)
- **User messages:** compact bubble, right-aligned, `bg-accent text-white`, `border-radius: 20px 20px 4px 20px`
- **AI responses:** full-width block, left-aligned, no bubble. Subtle left border accent line (2px orange). Content rendered with Streamdown for markdown.
- **Thinking indicator:** spinner + status text below the last message
- **Process steps:** checkmarks for completed, spinner for active
- **Session sidebar:** left panel (220px) with session list, collapsible

## Pages

### Dashboard (`/`)
- Greeting: "Good morning, David"
- 3-4 metric cards in a row
- Recent activity feed
- Quick action buttons (New Report, New Chat, etc.)

### Reports (`/reports`, `/reports/:id`)
- Landing: centered input, data source pills, recent reports
- Session: chat-style with query bubbles, accordion results, Generate Report button
- Full report: executive summary, metric cards, chart, insights, recommendations

### Repos (`/repos`, `/repos/:owner/:repo`)
- Card grid for repos
- Detail: tabs for PRs and Issues with action buttons

### Tickets (`/tickets`)
- List view with status badges, priority colors, filter dropdown
- Create dialog with repo selector

### Emails (`/emails`)
- Composer card + sent history list

### Settings (`/settings`)
- Account connections (GitHub, Google)
- Database connections with type selector and enable/disable toggle

### Admin (`/admin`)
- User allowlist table with invite form

### Login (`/login`)
- Centered card with warm background pattern
- Google OAuth + email/password tabs

## Dark Mode Implementation
- CSS custom properties on `:root` and `.dark` class
- Toggle via `<html class="dark">` — persisted in localStorage
- Sun/moon toggle in sidebar footer
- All components reference CSS variables, no hardcoded colors
- Transition: `transition: background-color 0.2s, color 0.2s, border-color 0.2s` on body

## Animations (following design-with-taste principles)
- Sidebar collapse/expand: 200ms ease-out width transition
- Page transitions: subtle fade (150ms)
- Card hover: shadow + translateY(-1px) over 150ms
- Accordion expand: height animation with overflow hidden
- Chat message appear: fade-in + slide-up (200ms)
- Dark mode toggle: smooth 200ms color transition on all surfaces

## Accessibility
- All interactive elements: visible focus ring (2px orange, offset 2px)
- Touch targets: minimum 44px
- Color contrast: 4.5:1 for text, 3:1 for large text
- Keyboard navigation: full tab support, escape to close modals
- Reduced motion: respect `prefers-reduced-motion`

## Files to Create/Modify
- `src/app/globals.css` — CSS variables for light/dark, base styles
- `src/app/layout.tsx` — dark mode class management
- `src/components/ui/theme-toggle.tsx` — new: sun/moon toggle component
- `src/components/layout/sidebar.tsx` — new: extracted sidebar with collapse logic
- `src/app/(dashboard)/layout.tsx` — use new sidebar component
- All existing page and component files — update classNames to use design tokens
- `tailwind.config.ts` — extend theme with warm color palette
