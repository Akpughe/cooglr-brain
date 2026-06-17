// Connector brand marks — the actual official SVGs served from
// /public/connector-logos (used nominatively to identify each integration).

function Logo({ src, alt, className, size = 20 }: { src: string; alt: string; className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

export function SlackLogo({ className, size }: { className?: string; size?: number }) {
  return <Logo src="/connector-logos/slack.svg" alt="Slack" className={className} size={size} />;
}
export function GitHubLogo({ className, size }: { className?: string; size?: number }) {
  return <Logo src="/connector-logos/github.svg" alt="GitHub" className={className} size={size} />;
}
export function GoogleDriveLogo({ className, size }: { className?: string; size?: number }) {
  return <Logo src="/connector-logos/drive.svg" alt="Google Drive" className={className} size={size} />;
}
export function GmailLogo({ className, size }: { className?: string; size?: number }) {
  return <Logo src="/connector-logos/gmail.svg" alt="Gmail" className={className} size={size} />;
}
export function GoogleMeetLogo({ className, size }: { className?: string; size?: number }) {
  return <Logo src="/connector-logos/google-meet.svg" alt="Google Meet" className={className} size={size} />;
}
export function NotionLogo({ className, size }: { className?: string; size?: number }) {
  return <Logo src="/connector-logos/notion.svg" alt="Notion" className={className} size={size} />;
}
export function TeamsLogo({ className, size }: { className?: string; size?: number }) {
  return <Logo src="/connector-logos/teams.svg" alt="Microsoft Teams" className={className} size={size} />;
}
