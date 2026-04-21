import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LogEntry, LicenceEntry, ProfileData } from "./data";

interface PDFInput {
  logs: LogEntry[];
  licences: LicenceEntry[];
  profile: ProfileData;
}

export function generateLogbookPDF({ logs, licences, profile }: PDFInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  drawCoverPage(doc, profile, pageW, pageH);
  doc.addPage("a4", "landscape");
  drawLicencePage(doc, licences, pageW);
  if (logs.length > 0) {
    doc.addPage("a4", "landscape");
    drawLogPages(doc, logs, profile, pageW);
  }
  doc.save("AMEL_Logbook.pdf");
}

function drawCoverPage(doc: jsPDF, profile: ProfileData, pageW: number, pageH: number) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  const cx = pageW / 2;
  const cy = pageH / 2 - 30;

  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(2);
  doc.circle(cx, cy, 22);
  doc.setLineWidth(1.5);
  doc.line(cx - 18, cy, cx - 35, cy);
  doc.line(cx + 18, cy, cx + 35, cy);
  doc.line(cx, cy - 18, cx - 8, cy - 28);
  doc.line(cx, cy - 18, cx + 8, cy - 28);
  doc.line(cx - 8, cy - 28, cx + 8, cy - 28);
  doc.line(cx, cy - 18, cx, cy + 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(20, 20, 20);
  doc.text("AMEL LOGBOOK", cx, cy + 42, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Aircraft Maintenance Engineer's Work Record", cx, cy + 54, { align: "center" });

  if (profile.name) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(profile.name, cx, cy + 72, { align: "center" });
  }
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(`email: ${profile.email}`);
  if (profile.phone) contactParts.push(`phone: ${profile.phone}`);
  if (contactParts.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(contactParts.join(" | "), cx, cy + 80, { align: "center" });
  }
  if (profile.address) {
    doc.setFontSize(10);
    doc.text(profile.address, cx, cy + 86, { align: "center" });
  }
  if (profile.ame_licence_no) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`AME LICENCE NO: ${profile.ame_licence_no}`, cx, cy + 98, { align: "center" });
  }
}

function drawLicencePage(doc: jsPDF, licences: LicenceEntry[], pageW: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text("Licences & Ratings", 15, 20);
  doc.setDrawColor(180, 140, 60);
  doc.setLineWidth(0.8);
  doc.line(15, 23, pageW - 15, 23);

  if (licences.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text("No licences recorded. Add your licences in the Experience screen.", 15, 35);
    return;
  }

  autoTable(doc, {
    startY: 28,
    head: [["AUTHORITY", "TYPE", "LICENCE NO.", "RATINGS", "ISSUE DATE", "EXPIRY DATE", "REMARKS"]],
    body: licences.map((l) => [
      (l.authority || "").toUpperCase(),
      (l.licence_type || "").toUpperCase(),
      (l.licence_number || "").toUpperCase(),
      (l.ratings || "").toUpperCase(),
      l.issue_date,
      l.expiry_date,
      (l.remarks || "").toUpperCase(),
    ]),
    styles: { fontSize: 9, cellPadding: 3, textColor: [20, 20, 20], lineColor: [200, 200, 200], lineWidth: 0.3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 15, right: 15 },
  });
}

function drawLogPages(doc: jsPDF, logs: LogEntry[], profile: ProfileData, pageW: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(`LOGBOOK OWNER: ${profile.name || "_______________"}`, 15, 12);
  doc.text(`AME LICENCE NO: ${profile.ame_licence_no || "___________"}`, pageW - 15, 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("AIRCRAFT MAINTENANCE ENGINEER'S (WORK RECORD/LOGBOOK)", pageW / 2, 12, { align: "center" });

  autoTable(doc, {
    startY: 16,
    head: [[
      "Date\n& Time", "Type of\nAircraft", "Aircraft\nRegn./Engine\nS.No./Component",
      "ATA\nChapter", "Maintenance Task", "Type of\nMaint.", "Type of\nActivity", "Duration\nin Hrs.", "Certifier Sign / Stamp",
    ]],
    body: logs.map((l) => {
      const date = new Date(l.created_at);
      const dateStr = `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}\n${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
      const ata = l.ata_chapter.split(" ")[0];
      const U = (s: string) => (s || "").toUpperCase();
      // Build a personal, narrative-style task description.
      const parts: string[] = [];
      if (l.fault_description) {
        parts.push(`REPORTED: ${U(l.fault_description.trim())}`);
      }
      if (l.symptoms && l.symptoms.length > 0) {
        parts.push(`SYMPTOMS OBSERVED: ${U(l.symptoms.join(", "))}.`);
      }
      if (l.root_cause) {
        parts.push(`ROOT CAUSE IDENTIFIED AS ${U(l.root_cause.trim())}.`);
      }
      if (l.action_taken) {
        parts.push(`I ${U(l.action_taken.trim())}.`);
      }
      const task = parts.join(" ");
      return [
        dateStr, U(l.aircraft_model) || "—", U(l.registration) || "—", U(ata), task,
        l.root_cause ? "CORRECTIVE" : "ROUTINE",
        U(l.tools_used) || "-",
        String(l.time_spent_hours), "",
      ];
    }),
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [20, 20, 20],
      lineColor: [120, 120, 120],
      lineWidth: 0.3,
      overflow: "linebreak",
      valign: "middle",
      halign: "center",
      minCellHeight: 30,
    },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, halign: "center", valign: "middle" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 30 },
      3: { cellWidth: 14 },
      4: {
        cellWidth: "auto",
        halign: "left",
        valign: "middle",
        fontSize: 9,
        cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      },
      5: { cellWidth: 20 },
      6: { cellWidth: 22 },
      7: { cellWidth: 16 },
      8: { cellWidth: 42 },
    },
    margin: { left: 10, right: 10 },
    didParseCell: (data) => {
      // Maintenance-task cell: left-align short narratives, justify long multi-line ones for clean print look.
      if (data.section === "body" && data.column.index === 4) {
        const raw = String(data.cell.raw ?? "").trim();
        if (raw.length > 140) {
          data.cell.styles.halign = "justify";
        } else {
          data.cell.styles.halign = "left";
        }
        // Tighten line spacing slightly so paragraphs don't feel scattered.
        (data.cell.styles as any).lineHeight = 1.25;
      }
    },
    didDrawCell: (data) => {
      // Render the Certifier Sign / Stamp cell content manually so it looks like a real sign-off block.
      if (data.section === "body" && data.column.index === 8) {
        const { x, y, width, height } = data.cell;
        const padding = 2;
        // Signature line (upper third)
        const sigY = y + height * 0.42;
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.3);
        doc.line(x + padding + 1, sigY, x + width - padding - 1, sigY);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6.5);
        doc.setTextColor(110, 110, 110);
        doc.text("Name / Signature", x + width / 2, sigY + 3, { align: "center" });

        // Stamp box (lower portion)
        const boxW = Math.min(28, width - padding * 2 - 2);
        const boxH = Math.min(12, height - (sigY - y) - 6);
        if (boxH > 4) {
          const boxX = x + (width - boxW) / 2;
          const boxY = sigY + 5;
          doc.setDrawColor(150, 150, 150);
          doc.setLineWidth(0.4);
          doc.rect(boxX, boxY, boxW, boxH);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(140, 140, 140);
          doc.text("STAMP", boxX + boxW / 2, boxY + boxH / 2 + 1.5, { align: "center" });
        }
        doc.setTextColor(20, 20, 20);
      }
    },
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`PAGE ${String(pageNum).padStart(2, "0")}`, pageW - 15, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    },
  });
}
