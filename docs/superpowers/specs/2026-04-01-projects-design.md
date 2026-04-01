# 500Claw Projects — Design Spec

**Sub-project 3** of the 500Claw platform redesign.
**Date:** 2026-04-01
**Status:** Draft

---

## Overview

Build a Linear-style project management app within the 500Claw workspace. Multiple projects per workspace, each with a Kanban board and list view. Tasks have types, priorities, assignees, labels, due dates, and optional GitHub repo linking. Task IDs are human-readable (PROJ-1). Drag-and-drop on the board. Task detail in a slide-over side panel. Placeholder AI chat panel for future integration.

### What's In Scope

- Multiple projects per workspace with sidebar navigation
- Kanban board view with customizable columns (add/rename/reorder/delete)
- List view (table) with sortable columns
- Task cards with: title, description (markdown), type (bug/feature/task/improvement), priority (urgent/high/medium/low), assignee, labels, due date, GitHub repo link
- Auto-incrementing task IDs (PROJ-1, PROJ-2)
- Default columns on project creation (To Do, In Progress, Done)
- Drag-and-drop between columns and within columns
- Task detail slide-over panel with inline editing
- Filter bar (assignee, priority, type, label)
- Create project modal with name + identifier
- Projects sidebar replacing placeholder
- Placeholder AI chat panel (UI only, not wired)

### What's Deferred

- AI triage (analyzing tasks, suggesting solutions)
- Task comments / activity log
- Subtasks / checklists
- Story points / estimates
- Time tracking
- Dependencies (blocked by)
- Board templates
- Notifications on task changes

---

## Database Schema

### New Tables

#### `projects`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `workspace_id` | uuid (FK → workspaces) | ON DELETE CASCADE |
| `name` | varchar(100) | Project name |
| `description` | text, nullable | |
| `identifier` | varchar(10) | Uppercase prefix for task IDs, e.g., "PROJ" |
| `task_counter` | int, default 0 | Auto-incrementing for task numbers |
| `created_by` | uuid (FK → auth.users) | |
| `created_at` | timestamptz | Default: `now()` |

RLS: All workspace members can SELECT. Workspace members can INSERT. Creator or workspace owner can UPDATE/DELETE.

#### `project_columns`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `project_id` | uuid (FK → projects) | ON DELETE CASCADE |
| `name` | varchar(50) | Column name |
| `color` | varchar(20) | Dot color identifier |
| `position` | int | Order in the board |
| `created_at` | timestamptz | Default: `now()` |

RLS: Inherits from project — workspace members can SELECT/INSERT/UPDATE/DELETE if they're members of the project's workspace.

#### `tasks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `project_id` | uuid (FK → projects) | ON DELETE CASCADE |
| `workspace_id` | uuid (FK → workspaces) | Denormalized for efficient RLS |
| `column_id` | uuid (FK → project_columns) | Current status column |
| `task_number` | int | Numeric part of display ID |
| `title` | varchar(255) | |
| `description` | text, nullable | Markdown content |
| `task_type` | varchar(20), default 'task' | 'bug', 'feature', 'task', 'improvement' |
| `priority` | varchar(10), default 'medium' | 'urgent', 'high', 'medium', 'low' |
| `assignee_id` | uuid (FK → auth.users), nullable | |
| `labels` | jsonb, default '[]' | Array of `{ name: string, color: string }` |
| `due_date` | date, nullable | |
| `github_repo` | varchar(255), nullable | "owner/repo" format |
| `position` | int | Order within column |
| `created_by` | uuid (FK → auth.users) | |
| `created_at` | timestamptz | Default: `now()` |
| `updated_at` | timestamptz | Default: `now()` |

RLS: Workspace members can SELECT/INSERT/UPDATE/DELETE tasks in their workspaces.

Indexes: `(project_id, column_id, position)`, `(workspace_id)`, `(assignee_id)`.

### Task ID Generation

When creating a task:
1. Atomically increment `projects.task_counter`: `UPDATE projects SET task_counter = task_counter + 1 WHERE id = $1 RETURNING task_counter`
2. Use the returned value as `task_number`
3. Display ID computed at read time: `{project.identifier}-{task.task_number}`

### Default Columns

When a project is created, auto-insert three columns:
- To Do (color: "red", position: 0)
- In Progress (color: "blue", position: 1)
- Done (color: "green", position: 2)

---

## UI Components

### Projects Sidebar (`projects-sidebar-content.tsx`)

Replaces the placeholder sidebar when the Projects app is active.

- Header: "Projects" + "+" button (opens create project modal)
- List of projects: name + task count, active one highlighted
- Click a project to navigate to its board

### Top Bar

- Project name (editable inline for owner)
- Filter toggle button
- View toggle: "Board" | "List" (segmented control)
- AI chat panel toggle button (right side)
- "+ Add column" button (board view only)

### Filter Bar

Collapsible bar below top bar:
- Assignee dropdown (workspace members)
- Priority dropdown (urgent/high/medium/low)
- Type dropdown (bug/feature/task/improvement)
- Label filter
- "All" | "Active" quick toggles (Active = exclude Done column)
- Clear filters button

### Board View (`board-view.tsx`)

- Horizontal scrollable container of columns
- Each column (`column-header.tsx`): colored dot, name, task count, "..." menu (rename, delete)
- Cards stacked vertically in each column
- "+ Add card" (`create-task-inline.tsx`) at bottom of each column: inline title input, Enter to create
- Drag-and-drop: HTML5 drag API, cards can move between columns and reorder within

### Task Card (`task-card.tsx`)

Compact card showing:
- Task type icon (Bug: `Circle`, Feature: `Star`, Task: `CheckSquare`, Improvement: `ArrowUp`)
- Title (truncated to 2 lines)
- Bottom row: assignee avatar (small), priority dot (colored), due date if set, label chips (small colored pills)
- Task ID in muted text (e.g., "PROJ-1")
- Click opens task detail panel

### List View (`list-view.tsx`)

Table with columns:
- ID (PROJ-1)
- Title
- Status (column name with colored dot)
- Priority (icon + text)
- Assignee (avatar + name)
- Type (icon)
- Due Date
- Labels

Sortable by clicking column headers. Click row to open task detail panel.

### Task Detail Panel (`task-detail-panel.tsx`)

Slide-over panel from the right (400px wide):
- Header: task ID + type badge + close button
- Title: large text, editable inline (click to edit)
- Properties grid (two-column layout):
  - Status: dropdown of project columns
  - Priority: dropdown (urgent/high/medium/low with colored dots)
  - Assignee: member picker dropdown
  - Type: dropdown (bug/feature/task/improvement)
  - Due date: date input
  - Labels: tag input (add/remove colored labels)
  - GitHub repo: text input
- Description: markdown textarea, editable
- Placeholder: "Activity & comments coming soon"
- Auto-save: debounced PATCH on each field change (500ms)

### AI Chat Panel (`ai-chat-panel.tsx`)

Placeholder panel that slides in from the right when toggled:
- Header: "Chat" + close button
- Body: "AI assistant coming soon" centered text
- Bottom: input with project name tag (non-functional)

### Create Project Modal (`create-project-modal.tsx`)

- Project name input
- Identifier input (auto-generated from name, uppercase, max 5 chars, editable)
- Optional description textarea
- "Create Project" button

---

## Routing

```
/{workspaceSlug}/projects                  → redirect to first project (or empty state)
/{workspaceSlug}/projects/[projectId]      → board/list view for project
```

No task-level routing — task detail opens as a side panel overlay.

---

## API Routes

### Projects

```
GET    /api/projects?workspaceId=xxx               → list projects (with task counts)
POST   /api/projects                                → create project + default columns
PATCH  /api/projects/[id]                           → update project (name, description, identifier)
DELETE /api/projects/[id]                           → delete project (cascades to columns + tasks)
```

### Columns

```
GET    /api/projects/[id]/columns                   → list columns ordered by position
POST   /api/projects/[id]/columns                   → create column
PATCH  /api/projects/[id]/columns/[colId]           → update column (name, color, position)
DELETE /api/projects/[id]/columns/[colId]           → delete column (moves tasks to first column)
```

### Tasks

```
GET    /api/projects/[id]/tasks?filters...          → list tasks with optional filters
POST   /api/projects/[id]/tasks                     → create task (auto-increment counter)
PATCH  /api/projects/tasks/[taskId]                 → update any task field
DELETE /api/projects/tasks/[taskId]                 → delete task
PATCH  /api/projects/tasks/reorder                  → batch reorder (drag-and-drop)
```

#### Task creation flow
1. `POST /api/projects/[id]/tasks` with `{ title, columnId, ... }`
2. Server uses service client to atomically: `UPDATE projects SET task_counter = task_counter + 1 WHERE id = $1 RETURNING task_counter`
3. Insert task with the returned `task_number`
4. Return the full task with computed display ID

#### Reorder flow
1. `PATCH /api/projects/tasks/reorder` with `{ tasks: [{ id, column_id, position }] }`
2. Server batch-updates all affected tasks in one transaction
3. Client sends only the tasks whose column_id or position changed

---

## Component File Structure

```
src/app/[workspaceSlug]/projects/
├── page.tsx                              → redirect to first project or empty state
└── [projectId]/page.tsx                  → board/list view (client component)

src/components/projects/
├── projects-sidebar-content.tsx          → project list for app sidebar
├── create-project-modal.tsx              → name + identifier form
├── board-view.tsx                        → Kanban columns layout + drag-and-drop
├── list-view.tsx                         → table view with sortable columns
├── task-card.tsx                         → compact card for board view
├── task-detail-panel.tsx                 → slide-over side panel for task editing
├── column-header.tsx                     → column dot + name + count + menu
├── create-task-inline.tsx                → inline title input at bottom of column
├── filter-bar.tsx                        → filter dropdowns and quick toggles
└── ai-chat-panel.tsx                     → placeholder right panel

src/app/api/projects/
├── route.ts                              → GET list, POST create
├── [id]/
│   ├── route.ts                          → PATCH, DELETE project
│   ├── columns/
│   │   ├── route.ts                      → GET, POST columns
│   │   └── [colId]/route.ts             → PATCH, DELETE column
│   └── tasks/
│       └── route.ts                      → GET, POST tasks
└── tasks/
    ├── [taskId]/route.ts                → PATCH, DELETE task
    └── reorder/route.ts                 → PATCH batch reorder
```

### Integration with App Sidebar

`app-sidebar.tsx` renders `projects-sidebar-content.tsx` when `activeApp.id === "projects"` (same pattern as Messages).

---

## Key Design Decisions

1. **Drag-and-drop via HTML5 API** — no extra library. `draggable`, `onDragStart`, `onDragOver`, `onDrop` with optimistic UI updates. PATCH reorder endpoint syncs to server.
2. **Task detail as side panel** — keeps board visible. No task-level URL routing. Panel state is component-local.
3. **Labels as jsonb** — no separate labels table. `[{name, color}]` array on each task. Simple, no joins, good enough for early stage.
4. **Position as integer** — reassign sequential integers on reorder. Simple, no fractional indexing complexity.
5. **Task counter on project** — atomic increment ensures unique task numbers per project without race conditions.
6. **Denormalized workspace_id on tasks** — enables efficient RLS without joining through projects table.
7. **Service client for task creation** — atomic counter increment needs to bypass RLS.
