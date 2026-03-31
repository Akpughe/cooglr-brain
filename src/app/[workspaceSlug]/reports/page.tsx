import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <BarChart3 className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-muted-foreground text-sm max-w-xs">AI-powered data analysis and reporting</p>
        </div>
      </div>
    </div>
  );
}
