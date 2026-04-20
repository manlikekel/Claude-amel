/**
 * NCAA O-PEL-020 Practical Maintenance Experience PDF export.
 *
 * Portrait, official-style table with a fixed 4-column layout:
 *   Aircraft Reg. No. | Details of Work Undertaken | Date Work Undertaken |
 *   Name, Signature, Licence No. of Certifying Engr. and Date
 *
 * The fourth column is intentionally left blank for handwritten certification.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LogEntry, ProfileData } from "./data";
import { generateNcaaWorkDetails, formatNcaaDate } from "./ncaa-text";

export interface NcaaExportInput {
  logs: LogEntry[];
  profile: ProfileData;
  includeAta?: boolean;
}

export function generateNcaaPracticalExperiencePDF({
  logs,
  profile,
  includeAta = true,
}: NcaaExportInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  drawHeader(doc, profile, pageW);
  drawTable(doc, logs, includeAta, pageW, pageH, profile);
  doc.save("NCAA_O-PEL-020_Practical_Experience.pdf");
}

function drawHeader(doc: jsPDF, profile: ProfileData, pageW: number) {
  // Top band
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("NIGERIAN CIVIL AVIATION AUTHORITY", pageW / 2, 14, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Form O-PEL-020", 15, 14);
  doc.text("Issue 02", pageW - 15, 14, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PRACTICAL MAINTENANCE EXPERIENCE LOGBOOK", pageW / 2, 22, { align: "center" });

  // Identity strip
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.4);
  doc.line(15, 26, pageW - 15, 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const yId = 32;
  doc.text(`Name of Applicant: ${profile.name || "________________________"}`, 15, yId);
  doc.text(`Licence No.: ${profile.ame_licence_no || "____________"}`, pageW - 15, yId, { align: "right" });
}

function drawTable(
  doc: jsPDF,
  logs: LogEntry[],
  includeAta: boolean,
  pageW: number,
  pageH: number,
  profile: ProfileData,
) {
  const body = logs.map((log) => {
    const reg = log.registration ? formatRegDisplay(log.registration) : "—";
    const details = generateNcaaWorkDetails(
      {
        ata_chapter: log.ata_chapter,
        fault_description: log.fault_description,
        action_taken: log.action_taken,
        system_component: log.system_component,
        maintenance_reference: log.maintenance_reference,
        tools_used: log.tools_used,
      },
      { includeAta },
    );
    const date = formatNcaaDate(log.created_at);
    return [reg, details, date, ""];
  });

  if (body.length === 0) {
    body.push(["—", "No maintenance entries match the selected filters.", "—", ""]);
  }

  autoTable(doc, {
    startY: 38,
    head: [[
      "Aircraft\nReg. No.",
      "Details of Work Undertaken",
      "Date Work\nUndertaken",
      "Name, Signature, Licence No. of\nCertifying Engr. and Date",
    ]],
    body,
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      textColor: [20, 20, 20],
      lineColor: [60, 60, 60],
      lineWidth: 0.3,
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 18,
    },
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [20, 20, 20],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
      lineColor: [40, 40, 40],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: "auto", halign: "left" },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 50, halign: "center" },
    },
    margin: { left: 15, right: 15, top: 38 },
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      const totalPages = doc.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(
        `O-PEL-020 — Practical Maintenance Experience Logbook    |    ${profile.name || ""}`,
        15,
        pageH - 8,
      );
      doc.text(`Page ${pageNum} of ${totalPages}`, pageW - 15, pageH - 8, { align: "right" });
      doc.setTextColor(20, 20, 20);
    },
  });
}

/** Preserve dash format if registration has 1-2 leading letters/digits then alphanumerics. */
function formatRegDisplay(reg: string): string {
  const upper = reg.toUpperCase().replace(/\s+/g, "");
  if (upper.includes("-")) return upper;
  // Try to insert a dash after the country prefix (1-2 chars) for common formats.
  const m = upper.match(/^([A-Z]{1,2})([A-Z0-9]+)$/);
  if (m && m[2].length >= 2) return `${m[1]}-${m[2]}`;
  return upper;
}
