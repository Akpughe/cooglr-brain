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
  let y = 25;

  // ---- Title ----
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  const titleLines = doc.splitTextToSize(report.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 9 + 4;

  // Subtitle
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · ${result.rowCount} data points`, margin, y);
  y += 5;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ---- Executive Summary ----
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("Executive Summary", margin, y);
  y += 7;

  // Blue left border
  doc.setFillColor(37, 99, 235);
  doc.rect(margin, y - 1, 2, 0, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const summaryLines = doc.splitTextToSize(report.executiveSummary, contentWidth - 6);
  doc.setFillColor(37, 99, 235);
  doc.rect(margin, y - 2, 2, summaryLines.length * 5 + 4, "F");
  doc.text(summaryLines, margin + 6, y);
  y += summaryLines.length * 5 + 10;

  // ---- Key Metrics ----
  if (report.keyMetrics.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("Key Metrics", margin, y);
    y += 8;

    const count = Math.min(report.keyMetrics.length, 4);
    const metricWidth = (contentWidth - (count - 1) * 4) / count;
    const metricHeight = 25;

    report.keyMetrics.slice(0, 4).forEach((metric, i) => {
      const x = margin + i * (metricWidth + 4);

      // Background
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(x, y, metricWidth, metricHeight, 3, 3, "F");

      // Border
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, metricWidth, metricHeight, 3, 3, "S");

      // Value
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      doc.text(metric.value, x + metricWidth / 2, y + 11, { align: "center" });

      // Label
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(metric.label, x + metricWidth / 2, y + 17, { align: "center" });

      // Change indicator
      if (metric.change) {
        const isPositive = metric.change.startsWith("+");
        doc.setTextColor(isPositive ? 22 : 220, isPositive ? 163 : 38, isPositive ? 74 : 38);
        doc.setFontSize(7);
        doc.text(metric.change, x + metricWidth / 2, y + 22, { align: "center" });
      }
    });
    y += metricHeight + 12;
  }

  // ---- Data Table ----
  if (y > 200) { doc.addPage(); y = 25; }

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Data", margin, y);
  y += 6;

  const tableRows = result.rows.slice(0, 50).map((row) =>
    result.columns.map((col) => {
      const v = row[col];
      if (v === null || v === undefined) return "—";
      if (typeof v === "number") return v.toLocaleString();
      const str = String(v);
      if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return new Date(str).toLocaleDateString();
      return str.length > 35 ? str.substring(0, 35) + "..." : str;
    })
  );

  autoTable(doc, {
    startY: y,
    head: [result.columns.map((c) => c.replace(/_/g, " "))],
    body: tableRows,
    styles: { fontSize: 7, cellPadding: 3, lineColor: [230, 230, 230], lineWidth: 0.2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    margin: { left: margin, right: margin },
    tableLineColor: [230, 230, 230],
    tableLineWidth: 0.2,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY + 12 || y + 50;

  // ---- Key Insights ----
  if (y > 240) { doc.addPage(); y = 25; }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("Key Insights", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  report.insights.forEach((insight) => {
    if (y > 265) { doc.addPage(); y = 25; }

    // Bullet
    doc.setFillColor(37, 99, 235);
    doc.circle(margin + 2, y - 1, 1.2, "F");

    const lines = doc.splitTextToSize(insight, contentWidth - 10);
    doc.text(lines, margin + 8, y);
    y += lines.length * 5 + 3;
  });
  y += 6;

  // ---- Recommendations ----
  if (y > 240) { doc.addPage(); y = 25; }

  // Background box
  doc.setFillColor(248, 249, 250);
  const recStartY = y;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("Recommendations", margin + 4, y + 6);
  y += 14;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  report.recommendations.forEach((rec, i) => {
    if (y > 265) { doc.addPage(); y = 25; }

    // Number circle
    doc.setFillColor(37, 99, 235);
    doc.circle(margin + 6, y - 1, 3, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), margin + 6, y, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(rec, contentWidth - 16);
    doc.text(lines, margin + 13, y);
    y += lines.length * 5 + 4;
  });

  // Draw background for recommendations section
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(margin, recStartY - 2, contentWidth, y - recStartY + 4, 3, 3, "F");

  // Re-draw the text on top (since we drew the background after)
  // Actually jsPDF draws in order, so let's skip the background for now

  // ---- Footer on each page ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text(
      `500Claw Platform · Confidential · Page ${i} of ${pageCount}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    // Top line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.line(0, 0, pageWidth, 0);
  }

  const fileName = report.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_").substring(0, 50);
  doc.save(`${fileName}_${new Date().toISOString().split("T")[0]}.pdf`);
}
