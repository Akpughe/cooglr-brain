import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportData {
  title: string;
  executiveSummary: string;
  keyMetrics: { label: string; value: string; change: string | null }[];
  insights: string[];
  recommendations: string[];
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export function generateReportPDF(report: ReportData, result: QueryResult, prompt: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(report.title, margin, y);
  y += 10;

  // Subtitle
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleDateString()} · ${result.rowCount} data points analyzed · Query: "${prompt}"`, margin, y);
  y += 4;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Executive Summary
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Executive Summary", margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(report.executiveSummary, contentWidth);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 6;

  // Key Metrics
  if (report.keyMetrics.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Key Metrics", margin, y);
    y += 8;

    const metricWidth = contentWidth / Math.min(report.keyMetrics.length, 4);
    report.keyMetrics.forEach((metric, i) => {
      const x = margin + i * metricWidth;

      // Metric box
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(x, y, metricWidth - 4, 22, 2, 2, "F");

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(metric.value, x + (metricWidth - 4) / 2, y + 10, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(metric.label, x + (metricWidth - 4) / 2, y + 16, { align: "center" });

      if (metric.change) {
        const isPositive = metric.change.startsWith("+");
        doc.setTextColor(isPositive ? 22 : 220, isPositive ? 163 : 38, isPositive ? 74 : 38);
        doc.setFontSize(7);
        doc.text(metric.change, x + (metricWidth - 4) / 2, y + 20, { align: "center" });
      }
    });
    y += 30;
  }

  // Data Table
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Data", margin, y);
  y += 4;

  const tableRows = result.rows.slice(0, 50).map((row) =>
    result.columns.map((col) => {
      const v = row[col];
      if (v === null || v === undefined) return "—";
      if (typeof v === "number") return v.toLocaleString();
      const str = String(v);
      if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return new Date(str).toLocaleDateString();
      return str.length > 40 ? str.substring(0, 40) + "..." : str;
    })
  );

  autoTable(doc, {
    startY: y,
    head: [result.columns.map((c) => c.replace(/_/g, " "))],
    body: tableRows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    margin: { left: margin, right: margin },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY + 10 || y + 50;

  // Check if we need a new page
  if (y > 250) { doc.addPage(); y = 20; }

  // Insights
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Key Insights", margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  report.insights.forEach((insight) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const lines = doc.splitTextToSize(`• ${insight}`, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 2;
  });
  y += 4;

  // Recommendations
  if (y > 250) { doc.addPage(); y = 20; }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Recommendations", margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  report.recommendations.forEach((rec, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 2;
  });

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `500Claw Platform · Page ${i} of ${pageCount}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Download
  const fileName = report.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  doc.save(`${fileName}_${new Date().toISOString().split("T")[0]}.pdf`);
}
