import { ReportBuilder } from "@/components/reports/report-builder";

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <ReportBuilder />
    </div>
  );
}
