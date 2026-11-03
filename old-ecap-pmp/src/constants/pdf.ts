/**
 * Individual trainee record as a PDF.
 *
 * Loaded on demand from the modal (`await import(...)`), so jsPDF only ships
 * to users who actually download a record.
 *
 * Requires: npm i jspdf jspdf-autotable
 */
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import {
  attendancePct,
  audienceLabel,
  formatChange,
  formatDate,
  formatScore,
  STATUS_META,
  yesNo,
  type Enrollment,
} from "./utils";

const EMERALD: [number, number, number] = [5, 150, 105];
const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_100: [number, number, number] = [241, 245, 249];
const ROSE: [number, number, number] = [190, 18, 60];

const MARGIN = 14;

const lastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

const ensureSpace = (doc: jsPDF, y: number, needed: number) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return 20;
  }
  return y;
};

const keyValueTable = (
  doc: jsPDF,
  startY: number,
  pairs: [string, string][],
  columns: 1 | 2 = 2,
) => {
  const body: string[][] = [];
  for (let i = 0; i < pairs.length; i += columns) {
    const row: string[] = [];
    for (let c = 0; c < columns; c++) {
      const pair = pairs[i + c];
      row.push(pair ? pair[0] : "", pair ? pair[1] : "");
    }
    body.push(row);
  }

  const labelStyle = { fontStyle: "bold" as const, textColor: SLATE_500, cellWidth: 34 };
  autoTable(doc, {
    startY,
    body,
    theme: "plain",
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 9, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 3 }, textColor: SLATE_900 },
    columnStyles:
      columns === 2 ? { 0: labelStyle, 2: labelStyle } : { 0: labelStyle },
  });
  return lastY(doc);
};

/** Builds the document. Split from the download so it can be tested in Node. */
export const buildTraineeRecordPdf = (enrollments: Enrollment[], generatedAt = new Date()) => {
  if (enrollments.length === 0) throw new Error("No training records to export.");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const person = enrollments[0].participant;

  // ── Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...SLATE_900);
  doc.text("Training Attendance Record", MARGIN, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  doc.text(
    `Generated ${formatDate(generatedAt.toISOString().slice(0, 10))}`,
    pageWidth - MARGIN,
    20,
    { align: "right" },
  );

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 24, pageWidth - MARGIN, 24);

  // ── Trainee
  const certifiedCount = enrollments.filter((e) => e.status === "certified").length;
  let y = keyValueTable(doc, 28, [
    ["Name", person.name],
    ["NRC", person.nrc],
    ["Sex", person.sex],
    ["Designation", person.designation],
    ["Trainings", String(enrollments.length)],
    ["Certified in", `${certifiedCount} of ${enrollments.length}`],
  ]);

  // ── One section per training
  enrollments.forEach((e, index) => {
    const { participant: p, training: t } = e;

    y = ensureSpace(doc, y + 8, 70);

    doc.setFillColor(...SLATE_100);
    doc.rect(MARGIN, y - 5, pageWidth - MARGIN * 2, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...SLATE_900);
    doc.text(`${index + 1}. ${t.title}`, MARGIN + 2, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_500);
    doc.text(STATUS_META[e.status].label, pageWidth - MARGIN - 2, y + 1, { align: "right" });

    y = keyValueTable(doc, y + 6, [
      ["Training ID", t.id],
      ["Partner", t.partner],
      ["Start date", formatDate(t.startDate)],
      ["End date", formatDate(t.endDate)],
      ["Health facility", t.healthFacility],
      ["District", t.district],
      ["Training site", t.site],
      ["Master trainers", t.isMasterTrainerTraining ? "Yes" : "No"],
      ["Target audience", audienceLabel(t)],
      ["Sessions / hours", `${t.totalSessions} sessions, ${t.totalHours} hours`],
      ["Trainers", t.trainers.join("; ")],
      ["Materials", t.materials],
    ]);

    // Results
    const pct = attendancePct(e);
    autoTable(doc, {
      startY: y + 3,
      head: [["Attendance", "Pre-test", "Post-test", "Change", "Completed", "Certified"]],
      body: [[
        `${e.attended} of ${e.held}${pct === null ? "" : ` (${pct}%)`}`,
        formatScore(p.preTest),
        formatScore(p.postTest),
        formatChange(e.scoreChange),
        yesNo(p.completedTraining),
        yesNo(p.certified),
      ]],
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 9, halign: "center", lineColor: [226, 232, 240], textColor: SLATE_900 },
      headStyles: { fillColor: EMERALD, textColor: 255, fontStyle: "bold" },
    });

    // Sessions
    autoTable(doc, {
      startY: lastY(doc) + 4,
      head: [["#", "Session", "Attendance"]],
      body: t.sessions.map((s) => {
        const a = p.attendance[s.number - 1];
        return [String(s.number), s.title, a === null || a === undefined ? "Not held yet" : a ? "Present" : "Absent"];
      }),
      theme: "striped",
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8.5, cellPadding: 1.6, textColor: SLATE_900 },
      headStyles: { fillColor: SLATE_900, textColor: 255 },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 2: { cellWidth: 30 } },
      didParseCell: (data: CellHookData) => {
        if (data.section !== "body" || data.column.index !== 2) return;
        const text = String(data.cell.raw);
        if (text === "Absent") {
          data.cell.styles.textColor = ROSE;
          data.cell.styles.fontStyle = "bold";
        } else if (text === "Present") {
          data.cell.styles.textColor = EMERALD;
        } else {
          data.cell.styles.textColor = SLATE_500;
        }
      },
    });

    y = lastY(doc);
  });

  // ── Footer on every page
  const pages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    doc.text(`${person.name}, NRC ${person.nrc}`, MARGIN, pageHeight - 10);
    doc.text(`Page ${i} of ${pages}`, pageWidth - MARGIN, pageHeight - 10, { align: "right" });
  }

  return doc;
};

export const traineeRecordFileName = (e: Enrollment) => {
  const name = e.participant.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const nrc = e.participant.nrc.replace(/\D/g, "");
  return `training-record-${name}-${nrc || "no-nrc"}.pdf`.toLowerCase();
};

export const downloadTraineeRecordPdf = (enrollments: Enrollment[]) => {
  const doc = buildTraineeRecordPdf(enrollments);
  doc.save(traineeRecordFileName(enrollments[0]));
};
