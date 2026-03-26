import { ReportBuilder } from "@/components/reports/report-builder";

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Reports</h1>
      </div>
      <ReportBuilder />
    </div>
  );
}
