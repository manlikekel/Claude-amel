/**
 * EASA Part-66 Practical Experience Logbook PDF export.
 *
 * Portrait A4, 5-column layout:
 *   Aircraft Reg. | Task Description | Date | Hours | Certifying Engineer Sign.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LogEntry, ProfileData } from "./data";
import { generateNcaaWorkDetails, formatNcaaDate } from "./ncaa-text";

export interface EasaExportInput {
  logs: LogEntry[];
  profile: ProfileData;
  includeAta?: boolean;
}

export function generateEasaPracticalExperiencePDF({ logs, profile, includeAta = true }: EasaExportInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EUROPEAN UNION AVIATION SAFETY AGENCY (EASA)", pageW / 2, 14, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Part-66 AME Licence", 15, 14);
  doc.text("Annex III", pageW - 15, 14, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("PRACTICAL EXPERIENCE LOGBOOK", pageW / 2, 22, { align: "center" });
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.4);
  doc.line(15, 26, pageW - 15, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`NAME: ${(profile.name || "________________________").toUpperCase()}`, 15, 32);
  doc.text(`LICENCE NO.: ${(profile.ame_licence_no || "____________").toUpperCase()}`, pageW - 15, 32, { align: "right" });

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
    const hours = log.time_spent_hours ? `${log.time_spent_hours.toFixed(1)}h` : "—";
    return [reg, details, date, hours, ""];
  });

  if (body.length === 0) body.push(["—", "NO ENTRIES.", "—", "—", ""]);

  autoTable(doc, {
    startY: 38,
    head: [["Aircraft\nReg.", "Task Description", "Date", "Hours", "Certifying\nEngineer Sign."]],
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
      fillColor: [0, 60, 120],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      lineColor: [0, 40, 90],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 24, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 38, halign: "center" },
    },
    margin: { left: 15, right: 15, top: 38 },
    didDrawPage: () => {
      const pn = doc.getCurrentPageInfo().pageNumber;
      const tot = doc.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(`EASA Part-66 Practical Experience Logbook  |  ${profile.name || ""}`, 15, pageH - 8);
      doc.text(`Page ${pn} of ${tot}`, pageW - 15, pageH - 8, { align: "right" });
      doc.setTextColor(20, 20, 20);
    },
  });

  doc.save("EASA_Part66_Practical_Experience.pdf");
}
