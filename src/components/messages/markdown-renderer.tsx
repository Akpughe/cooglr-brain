"use client";

export function MarkdownRenderer({ content }: { content: string }) {
  const html = renderMarkdown(content);
  return (
    <div
      className="text-sm leading-relaxed [&_strong]:font-semibold [&_em]:italic [&_code]:text-[13px] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:my-1 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_a]:text-primary [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(text: string): string {
  // SECURITY: escapeHtml runs FIRST on raw user input, converting all HTML
  // special characters to entities. This prevents XSS since no raw HTML
  // from users can execute. Markdown patterns are then applied to the
  // already-escaped text, producing only our controlled HTML tags.
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  html = html.replace(
    /(?<!href="|">)(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  html = html.replace(/\n/g, "<br>");
  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
