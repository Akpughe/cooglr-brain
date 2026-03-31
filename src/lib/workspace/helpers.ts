export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function formatMember(m: {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: unknown;
}) {
  const profile = m.profiles as { full_name?: string; email?: string; avatar_url?: string } | null;
  return {
    id: m.id,
    userId: m.user_id,
    fullName: profile?.full_name || "",
    email: profile?.email || "",
    avatarUrl: profile?.avatar_url || null,
    role: m.role as "owner" | "member",
    joinedAt: m.joined_at,
  };
}
