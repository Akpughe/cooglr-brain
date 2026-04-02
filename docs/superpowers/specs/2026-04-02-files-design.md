# Files (Notion-like) — Design Spec

**Sub-project:** 4 of 6
**Date:** 2026-04-02
**Branch:** `feat/workspaces-apps-collaboration` (continued)
**Status:** Design approved

---

## Overview

Add a Notion-like document editor and file storage system to the platform. Users create rich-text pages using a TipTap editor, organize content in a nested tree (pages, folders, uploaded files), and manage privacy with optional per-file locking and sharing.

## Scope

### In Scope

- Nested tree of pages, folders, and uploaded files (unified node model)
- TipTap rich-text editor with essential formatting + media (images, file attachments, tables)
- File upload to Supabase Storage with inline preview (images, PDFs, video, audio)
- Folder view showing child contents in a sortable list
- Sidebar file tree with collapse/expand, drag-to-reorder, context menu, search, recently edited
- Emoji icons and cover images for pages
- Auto-save (debounced 1s)
- Privacy toggle: public (default, all workspace members) or private (creator only + explicit shares)
- Share modal for granting view/edit access to private files
- Lightweight editing awareness via existing Presence system (who's viewing/editing)
- Realtime sidebar updates via Postgres Changes
- Drag-and-drop reorder and move within the tree

### Deferred

- Real-time collaborative editing (CRDT/Yjs) — future enhancement
- Slash command menu — future enhancement
- Block-level drag-to-reorder within the editor — future enhancement
- Callout boxes, toggle/collapsible sections — future enhancement
- Version history / undo — future enhancement
- Trash / soft delete — future enhancement
- Comments on pages — future enhancement
- Full-text search across document content — future enhancement
- Templates — future enhancement

---

## Database Schema

### Migration: `016_files.sql`

#### Table: `files`

Unified node table — every item (page, folder, uploaded file) is a row.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| workspace_id | uuid | NOT NULL, FK → workspaces(id) CASCADE | Workspace scoping |
| parent_id | uuid | FK → files(id) SET NULL, nullable | Self-referential. NULL = root level |
| type | text | NOT NULL, CHECK IN ('page', 'folder', 'file') | Node type |
| title | text | NOT NULL, default 'Untitled' | Display name |
| content | jsonb | nullable | TipTap JSON document (pages only) |
| icon | text | nullable | Emoji icon for page/folder |
| cover_url | text | nullable | Banner image URL (pages only) |
| storage_path | text | nullable | Supabase Storage path (files only) |
| mime_type | text | nullable | e.g. 'application/pdf' (files only) |
| file_size | bigint | nullable | Bytes (files only) |
| is_private | boolean | NOT NULL, default false | Privacy toggle |
| position | integer | NOT NULL, default 0 | Sort order within parent |
| created_by | uuid | NOT NULL, FK → auth.users(id) | Creator |
| updated_at | timestamptz | NOT NULL, default now() | Auto-updated on save |
| created_at | timestamptz | NOT NULL, default now() | |

#### Table: `file_shares`

Join table for sharing private files with specific users.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| file_id | uuid | NOT NULL, FK → files(id) CASCADE | |
| shared_with | uuid | NOT NULL, FK → auth.users(id) | Target user |
| permission | text | NOT NULL, CHECK IN ('view', 'edit') | Access level |
| created_at | timestamptz | NOT NULL, default now() | |

**Unique constraint:** `(file_id, shared_with)` — one share record per user per file.

#### Indexes

- `(workspace_id, parent_id)` — tree queries (list children of a parent)
- `(workspace_id, type)` — filter by node type
- `(created_by)` — "my files" queries
- `(workspace_id, updated_at DESC)` — recently edited
- `file_shares(file_id, shared_with)` — unique, share lookups

#### RLS Policies

**files:**

- **SELECT:** User is a workspace member AND (is_private = false OR created_by = auth.uid() OR id IN (SELECT file_id FROM file_shares WHERE shared_with = auth.uid()))
- **INSERT:** User is a workspace member (workspace_id checked via `get_user_workspace_ids()`)
- **UPDATE:** If is_private = false → any workspace member. If is_private = true → created_by = auth.uid() OR file_id in file_shares with permission = 'edit'
- **DELETE:** created_by = auth.uid() only

**file_shares:**

- **SELECT:** shared_with = auth.uid() OR file_id owned by auth.uid() (creator sees who they've shared with)
- **INSERT:** file creator only (created_by on the parent file = auth.uid())
- **DELETE:** file creator only

#### Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE files;
```

File shares do not need realtime — sharing is infrequent and the share modal can refetch.

#### Trigger: `updated_at`

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

---

## Routing

| Route | Purpose |
|-------|---------|
| `/{workspaceSlug}/files` | Root page — redirects to first root-level page, or shows empty state if no files exist |
| `/{workspaceSlug}/files/{fileId}` | Unified view — fetches the file node and renders page editor, folder view, or file preview based on `type` |

Single dynamic route `[fileId]/page.tsx` handles all three node types. The page fetches the node, checks type, and renders the appropriate component.

---

## API Endpoints

### Files CRUD

**GET `/api/files?workspaceId=X`**
- Returns flat list of all accessible files for the workspace (sidebar builds tree client-side from parent_id)
- Fields returned: id, parent_id, type, title, icon, is_private, position, created_by, updated_at
- Content field excluded from list (fetched per-file on open)
- Respects RLS (private files filtered server-side)

**GET `/api/files/{id}`**
- Returns full file node including content
- Used when opening a page for editing

**POST `/api/files`**
- Body: `{ workspaceId, title, type, parentId?, icon? }`
- Creates a new page, folder, or file node
- Position defaults to max(position) + 1 within the parent
- Returns created file node

**PATCH `/api/files/{id}`**
- Body: any combination of `{ title, content, icon, coverUrl, isPrivate, parentId, position }`
- Used for auto-save (content), rename, move, privacy toggle
- Returns updated file node

**DELETE `/api/files/{id}`**
- Creator only
- Cascades to children (deletes entire subtree)
- If type is 'file', also deletes from Supabase Storage

### Upload

**POST `/api/files/upload`**
- FormData: `file, workspaceId, parentId?`
- Uploads file to Supabase Storage bucket `file-uploads`
- Storage path: `{workspaceId}/{fileId}/{uuid}.{ext}`
- Creates a file node in the `files` table with storage_path, mime_type, file_size
- Max file size: 50MB
- Returns created file node

**POST `/api/files/upload-image`**
- FormData: `file, workspaceId`
- For editor inline images and cover images
- Uploads to `file-uploads` bucket under `{workspaceId}/images/{uuid}.{ext}`
- Max size: 10MB
- Returns `{ url }` only (no file node created — these are embedded in page content)

### Sharing

**POST `/api/files/{id}/share`**
- Body: `{ userId, permission: 'view' | 'edit' }`
- Creator only (file.created_by must match current user)
- Creates file_shares record
- Returns share record

**DELETE `/api/files/{id}/share/{userId}`**
- Creator only
- Removes the share record

### Reorder

**PATCH `/api/files/reorder`**
- Body: `{ updates: [{ id, parentId, position }] }`
- Batch update for drag-and-drop moves
- Used when reordering within a parent or moving between parents
- Service client for atomic position reassignment

---

## UI Components

### Sidebar: `files-sidebar-content.tsx`

- **Header:** "Files" label + new page button (📄+) + upload button (⬆️)
- **Search input:** Filters tree nodes by title match, instant
- **File tree:** Recursive collapsible tree showing all accessible files
  - 📄 Pages — click to open in editor
  - 📁 Folders — click to expand/collapse, double-click to open folder view
  - 📎 Files — click to open preview
  - 🔒 Private items — lock icon + "private" badge
  - Active item highlighted with accent background
  - Hover shows "+" button to create child page
  - Right-click context menu: Rename, Delete, Move to..., Make private/public, Share
  - Drag & drop to reorder or move into folders
  - Indentation per depth level (20px per level)
- **Recently edited section:** Bottom of sidebar, shows last 5 edited files with relative timestamps

### Page Editor: `page-editor.tsx`

- **Cover image:** Optional gradient or uploaded image at top (160px). Hover shows "Change cover" / "Remove" controls. Click "Add cover" to show color/upload picker.
- **Icon:** Emoji displayed at 48px overlapping cover bottom-left. Click to open emoji picker. "Add icon" button shown on hover when no icon set.
- **Title:** Large editable text (32px, bold). Placeholder "Untitled". Changes auto-saved.
- **Meta bar:** Creator name, "Edited X ago" timestamp, presence dots (who's viewing), privacy toggle, overflow menu (delete, move).
- **Toolbar:** Grouped button bar above editor content:
  - Text: Bold, Italic, Underline, Strikethrough, Inline Code
  - Headings: H1, H2, H3
  - Lists: Bullet, Numbered, Task (checkbox)
  - Blocks: Blockquote, Horizontal Rule, Code Block
  - Media: Link, Image, File Attachment, Table
- **Editor body:** TipTap instance, max-width 720px centered. Content stored as TipTap JSON.
- **Auto-save:** Debounced 1s after last keystroke. PATCH to `/api/files/{id}` with content JSON.

### TipTap Extensions (v1)

- `StarterKit` (paragraphs, bold, italic, strike, code, headings, lists, blockquote, code block, horizontal rule)
- `Underline`
- `Link` (with URL popover)
- `Image` (upload via toolbar or paste/drop, stored in Supabase Storage)
- `Table`, `TableRow`, `TableCell`, `TableHeader` (basic table support)
- `TaskList`, `TaskItem` (checkboxes)
- `Placeholder` ("Start writing...")
- `FileAttachment` (custom extension — renders download card for attached files)

### Folder View: `folder-view.tsx`

- **Header:** Folder icon + name (editable inline) + item count + "New page" and "Upload" buttons
- **Contents table:** Columns — Name (with icon), Type, Modified (relative time), Created by
- **Sorting:** Click column headers to sort
- **Row click:** Navigates to child (opens page editor, folder view, or file preview)
- **Empty state:** "This folder is empty" with create/upload prompts

### File Preview: `file-preview.tsx`

- **Header:** File type icon + filename + meta (type, size, uploader, date) + Download button + overflow menu
- **Preview area:** Based on mime_type:
  - Images (jpg, png, gif, webp, svg): Rendered inline, click to expand
  - PDFs: iframe embed
  - Video (mp4, webm): HTML5 video player
  - Audio (mp3, wav): HTML5 audio player
  - Text/code files: Syntax-highlighted read-only view
  - Other: Download card with file type icon

### Share Modal: `share-modal.tsx`

- Opens from context menu or file header overflow menu
- Member picker dropdown (workspace members)
- Permission selector: View / Edit
- List of current shares with remove button
- Only shown for private files, only usable by creator

### Upload Zone: `upload-zone.tsx`

- Drag-and-drop overlay on main content area
- Also triggered by upload button in sidebar/folder header
- Shows upload progress
- Creates file node on completion

### Emoji Picker: `emoji-picker.tsx`

- Simple emoji grid (common emojis)
- Shown as popover when clicking page/folder icon
- Sets `icon` field on the file node

---

## Component File Structure

```
src/app/[workspaceSlug]/files/
├── page.tsx                          # Root redirect
└── [fileId]/page.tsx                 # Unified view (page/folder/file)

src/components/files/
├── files-sidebar-content.tsx         # Tree sidebar + search + recents
├── file-tree.tsx                     # Recursive tree component
├── file-tree-node.tsx                # Single tree node (expand, icons, context menu)
├── page-editor.tsx                   # TipTap editor wrapper
├── editor-toolbar.tsx                # Formatting toolbar
├── folder-view.tsx                   # Folder contents list
├── file-preview.tsx                  # File preview (image/pdf/video/download)
├── file-header.tsx                   # Title, meta, actions bar (shared across views)
├── create-page-modal.tsx             # New page with title + parent picker
├── upload-zone.tsx                   # Drag-drop upload area
├── share-modal.tsx                   # Share private file with member picker
└── emoji-picker.tsx                  # Icon selector for pages/folders

src/lib/files/
└── types.ts                          # FileNode, FileShare, FileType, etc.

src/app/api/files/
├── route.ts                          # GET list, POST create
├── [id]/route.ts                     # GET, PATCH, DELETE single file
├── [id]/share/route.ts               # POST share
├── [id]/share/[userId]/route.ts      # DELETE revoke share
├── upload/route.ts                   # POST file upload
├── upload-image/route.ts             # POST editor image upload
└── reorder/route.ts                  # PATCH batch reorder

supabase/migrations/
└── 016_files.sql                     # files + file_shares tables, RLS, indexes, trigger
```

---

## Realtime Architecture

### Postgres Changes — Sidebar Tree

Subscribe to `files` table filtered by `workspace_id`:
- **INSERT:** New node appears in sidebar tree at correct position
- **UPDATE:** Title/icon changes reflected live, position changes animate
- **DELETE:** Node removed from tree

Subscription created once in `files-sidebar-content.tsx` at mount.

### Presence — Editing Awareness

Extend the existing workspace-level Presence payload to include:
- `activeFileId: string | null` — which file the user currently has open

Components read this to show:
- "Sarah is viewing" in the file header meta bar (green dot + name)
- "Sarah is editing" warning if the same page is open for editing by another user

No blocking — just awareness. Last-save-wins for conflicts.

---

## Integration Points

### App Sidebar (`app-sidebar.tsx`)

Replace the Files placeholder in the sidebar switch statement with `<FilesSidebarContent />`.

### App Registry

Files app is already registered in `registry.ts` and `012_workspaces_and_apps.sql` (id: 'files', sort_order: 3, hasSidebar: true). No changes needed.

### Workspace Presence

Add `activeFileId` field to presence payload in `use-presence.ts`. Other apps ignore this field.

### Supabase Storage

Create `file-uploads` bucket (public) in Supabase dashboard or via migration. Path convention: `{workspaceId}/{fileId}/{uuid}.{ext}` for file uploads, `{workspaceId}/images/{uuid}.{ext}` for editor images.

---

## Key Design Decisions

1. **Unified node table** — Pages, folders, and files are all rows in one `files` table with a `type` discriminator. Simpler tree queries, single API surface, uniform drag-and-drop. Trade-off: some nullable columns per type.

2. **TipTap with essential + media extensions** — Covers headings, lists, formatting, images, file attachments, and tables. Defers slash commands, block drag-and-drop, and advanced blocks to future iterations.

3. **No real-time collaboration** — Lightweight presence awareness (who's viewing/editing) instead of CRDT-based live editing. Dramatically reduces complexity. Can upgrade later with TipTap's Yjs extension.

4. **Privacy model: public default + opt-in private** — Matches existing workspace-wide visibility pattern from Messages and Projects. Private toggle + share modal gives users control without complex permission trees.

5. **Single dynamic route** — `[fileId]/page.tsx` handles all three node types based on the fetched node's `type` field. Avoids separate route segments for pages/folders/files.

6. **Content excluded from list endpoint** — GET list returns tree metadata only. Full content (TipTap JSON) fetched per-file on open. Keeps sidebar load fast.

7. **Auto-save with debounce** — 1-second debounce after last keystroke. PATCH sends only the content field. No manual save button.

8. **Client-side tree building** — API returns flat list, sidebar builds the tree from parent_id relationships. Simpler API, tree logic lives in one place.

9. **File attachments in editor as custom extension** — TipTap custom node that renders a download card. The file is uploaded to Storage and referenced by URL in the document JSON, not stored in a separate table.

10. **50MB file limit, 10MB image limit** — Reasonable defaults for a team workspace. Can be adjusted per plan tier later.
