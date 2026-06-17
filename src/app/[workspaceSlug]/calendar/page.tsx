import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function CalendarPage() {
  return (
    <EmptyState
      icon={Calendar}
      title="Calendar"
      description="Synced calendar from Google and iCloud coming soon."
    />
  );
}
