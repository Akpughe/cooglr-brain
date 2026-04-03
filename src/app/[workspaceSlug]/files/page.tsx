import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const WELCOME_CONTENT = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Welcome to 500Claw Files" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Your docs and files, all in one place." }],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "What is this?" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Files is your workspace's document hub. Create rich-text pages, organize them in folders, and upload files \u2014 all accessible to your team in real time.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "What you can do" }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Create pages" },
                { type: "text", text: " \u2014 Rich-text docs with headings, lists, tables, images, and code blocks" },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Upload files" },
                { type: "text", text: " \u2014 PDFs, images, videos, and any other files. Preview them inline." },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Organize with folders" },
                { type: "text", text: " \u2014 Nest pages and files in a tree structure, just like your file system" },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Keep things private" },
                { type: "text", text: " \u2014 Toggle any page or file to private, then share with specific teammates" },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Auto-save" },
                { type: "text", text: " \u2014 Everything saves automatically as you type. No save button needed." },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Getting started" }],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Edit this page" },
                { type: "text", text: " \u2014 Click anywhere and start typing. This is your page now." },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Create a new page" },
                { type: "text", text: " \u2014 Click the " },
                { type: "text", marks: [{ type: "code" }], text: "+" },
                { type: "text", text: " button in the sidebar" },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Upload a file" },
                { type: "text", text: " \u2014 Click the upload button or drag a file into the editor" },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Use the toolbar" },
                { type: "text", text: " \u2014 Format text, add headings, insert tables, embed images" },
              ],
            },
          ],
        },
      ],
    },
    { type: "horizontalRule" },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          marks: [{ type: "italic" }],
          text: "Tip: Right-click any item in the sidebar to rename, delete, or change its privacy.",
        },
      ],
    },
  ],
};

export default async function FilesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) redirect(`/${workspaceSlug}`);

  // Find first root-level page
  const { data: firstFile } = await supabase
    .from("files")
    .select("id")
    .eq("workspace_id", workspace.id)
    .is("parent_id", null)
    .eq("type", "page")
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (firstFile) {
    redirect(`/${workspaceSlug}/files/${firstFile.id}`);
  }

  // No files exist — create a welcome page automatically
  const svc = await createServiceClient();
  const { data: welcomePage } = await svc
    .from("files")
    .insert({
      workspace_id: workspace.id,
      type: "page",
      title: "Welcome to 500Claw",
      icon: "\u{1F44B}",
      content: WELCOME_CONTENT,
      position: 0,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (welcomePage) {
    redirect(`/${workspaceSlug}/files/${welcomePage.id}`);
  }

  // Fallback if creation fails
  redirect(`/${workspaceSlug}/files`);
}
