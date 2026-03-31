import { redirect } from "next/navigation";

// This page should never render — middleware redirects "/" to
// the active workspace or /onboarding. This exists as a fallback.
export default function RootPage() {
  redirect("/onboarding");
}
