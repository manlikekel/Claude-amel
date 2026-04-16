import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogs, getLicences, getProfile, type LogEntry, type LicenceEntry, type ProfileData } from "./store";

export function generateLogbookPDF() {
  const logs = getLogs();
  const licences = getLicences();
  const profile = getProfile();

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ===== PAGE 1: COVER =====
  drawCoverPage(doc, profile, pageW, pageH);

  // ===== PAGE 2: LICENCES =====
  doc.addPage("a4", "landscape");
  drawLicencePage(doc, licences, profile, pageW, pageH);

  // ===== PAGE 3+: LOG ENTRIES =====
  if (logs.length > 0) {
    doc.addPage("a4", "landscape");
    drawLogPages(doc, logs, profile, pageW, pageH);
  }

  doc.save("AMEL_Logbook.pdf");
}

function drawCoverPage(doc: jsPDF, profile: ProfileData, pageW: number, pageH: number) {
  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  // Logo - simplified aircraft silhouette
  const cx = pageW / 2;
  const cy = pageH / 2 - 30;

  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(2);
  doc.circle(cx, cy, 22);
  doc.setLineWidth(1.5);
  // Wings
  doc.line(cx - 18, cy, cx - 35, cy);
  doc.line(cx + 18, cy, cx + 35, cy);
  // Tail
  doc.line(cx, cy - 18, cx - 8, cy - 28);
  doc.line(cx, cy - 18, cx + 8, cy - 28);
  doc.line(cx - 8, cy - 28, cx + 8, cy - 28);
  // Body
  doc.line(cx, cy - 18, cx, cy + 22);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(20, 20, 20);
  doc.text("AMEL LOGBOOK", cx, cy + 42, { align: "center" });

  // Subtitle
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Aircraft Maintenance Engineer's Work Record", cx, cy + 54, { align: "center" });

  // Owner info
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

function drawLicencePage(doc: jsPDF, licences: LicenceEntry[], _profile: ProfileData, pageW: number, _pageH: number) {
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
    head: [["Authority", "Type", "Licence No.", "Ratings", "Issue Date", "Expiry Date", "Remarks"]],
    body: licences.map((l) => [
      l.authority,
      l.licence_type,
      l.licence_number,
      l.ratings,
      l.issue_date,
      l.expiry_date,
      l.remarks,
    ]),
    styles: { fontSize: 9, cellPadding: 3, textColor: [20, 20, 20], lineColor: [200, 200, 200], lineWidth: 0.3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 15, right: 15 },
  });
}

function drawLogPages(doc: jsPDF, logs: LogEntry[], profile: ProfileData, pageW: number, _pageH: number) {
  // Header text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  const headerLeft = `LOGBOOK OWNER: ${profile.name || "_______________"}`;
  const headerRight = `AME LICENCE NO: ${profile.ame_licence_no || "___________"}`;
  doc.text(headerLeft, 15, 12);
  doc.text(headerRight, pageW - 15, 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("AIRCRAFT MAINTENANCE ENGINEER'S (WORK RECORD/LOGBOOK)", pageW / 2, 12, { align: "center" });

  autoTable(doc, {
    startY: 16,
    head: [[
      "Date\n& Time",
      "Type of\nAircraft",
      "Aircraft\nRegn./Engine\nS.No./Component",
      "ATA\nChapter",
      "Maintenance Task",
      "Type of\nMaint.",
      "Type of\nActivity",
      "Duration\nin Hrs.",
      "Recurring",
    ]],
    body: logs.map((l) => {
      const date = new Date(l.created_at);
      const dateStr = `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}\n${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
      const ata = l.ata_chapter.split(" ")[0];
      const task = l.fault_description + (l.action_taken ? `\n→ ${l.action_taken}` : "");
      return [
        dateStr,
        l.aircraft_type,
        l.registration,
        ata,
        task,
        l.root_cause ? "Corrective" : "Routine",
        l.tools_used || "-",
        l.time_spent.toString(),
        l.is_recurring ? "Yes" : "No",
      ];
    }),
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [20, 20, 20], lineColor: [180, 180, 180], lineWidth: 0.3, overflow: "linebreak" },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 30 },
      3: { cellWidth: 14 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 18 },
      6: { cellWidth: 25 },
      7: { cellWidth: 16 },
      8: { cellWidth: 16 },
    },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      // Page numbers
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`PAGE ${String(pageNum).padStart(2, "0")}`, pageW - 15, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    },
  });
}
