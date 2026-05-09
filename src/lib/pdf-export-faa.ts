/**
 * FAA A&P Practical Experience Record PDF export.
 *
 * Portrait A4, 5-column layout:
 *   Date | Aircraft N-Number | Work Performed | Hrs | IA/A&P Signature & Cert. No.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LogEntry, ProfileData } from "./data";
import { generateNcaaWorkDetails, formatNcaaDate } from "./ncaa-text";

export function generateFaaPracticalExperiencePDF({
  logs,
  profile,
  includeAta = true,
}: {
  logs: LogEntry[];
  profile: ProfileData;
  includeAta?: boolean;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FEDERAL AVIATION ADMINISTRATION (FAA)", pageW / 2, 14, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("FAR Part 65", 15, 14);
  doc.text("A&P Certificate", pageW - 15, 14, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("PRACTICAL EXPERIENCE RECORD", pageW / 2, 22, { align: "center" });
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.4);
  doc.line(15, 26, pageW - 15, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`APPLICANT NAME: ${(profile.name || "________________________").toUpperCase()}`, 15, 32);
  doc.text(`CERTIFICATE NO.: ${(profile.ame_licence_no || "____________").toUpperCase()}`, pageW - 15, 32, { align: "right" });

  const body = logs.map((log) => {
    const reg = log.registration ? log.registration.toUpperCase() : "—";
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
    ).toUpperCase();
    const date = formatNcaaDate(log.created_at);
    const hours = log.time_spent_hours ? `${log.time_spent_hours.toFixed(1)}` : "—";
    return [date, reg, details, hours, ""];
  });

  if (body.length === 0) body.push(["—", "—", "NO ENTRIES.", "—", ""]);

  autoTable(doc, {
    startY: 38,
    head: [["Date", "Aircraft\nN-Number", "Work Performed", "Hrs", "IA/A&P Signature\n& Cert. No."]],
    body,
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
      lineColor: [60, 60, 60],
      lineWidth: 0.3,
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 16,
    },
    headStyles: {
      fillColor: [0, 70, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      lineColor: [0, 50, 20],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 38, halign: "center" },
    },
    margin: { left: 15, right: 15, top: 38 },
    didDrawPage: () => {
      const pn = doc.getCurrentPageInfo().pageNumber;
      const tot = doc.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(`FAA Part 65 Practical Experience Record  |  ${profile.name || ""}`, 15, pageH - 8);
      doc.text(`Page ${pn} of ${tot}`, pageW - 15, pageH - 8, { align: "right" });
      doc.setTextColor(20, 20, 20);
    },
  });

  doc.save("FAA_A&P_Practical_Experience.pdf");
}
