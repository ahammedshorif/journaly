import PDFDocument from "pdfkit";

/** Claude palette for PDFs */
export const PDF_COLORS = {
  text: "#3D3929",
  muted: "#7A7564",
  accent: "#D97757",
  border: "#E6E3DA",
  zebra: "#FAF9F5",
  profit: "#0B7A6C",
  loss: "#B2462F",
};

export interface PdfColumn {
  header: string;
  width: number; // relative weight
  align?: "left" | "right";
  /** colour a cell (e.g. green/red P&L) */
  color?: (value: string) => string | undefined;
}

/** Built-in PDF fonts are WinAnsi only — strip characters they can't draw (emoji etc.). */
export const pdfSafe = (s: string | null | undefined) =>
  (s ?? "").replace(/[^\x20-\x7E -ÿ–—‘’“”•…€]/g, "").trim();

export const pnlColor = (v: string) => (Number(v) > 0 ? PDF_COLORS.profit : Number(v) < 0 ? PDF_COLORS.loss : undefined);

export function createPdf(title: string, subtitle: string, landscape = false) {
  const doc = new PDFDocument({ size: "A4", layout: landscape ? "landscape" : "portrait", margin: 40, bufferPages: true });
  doc.info.Title = title;
  doc.info.Creator = "Trading Journal";

  doc.fillColor(PDF_COLORS.accent).font("Helvetica-Bold").fontSize(18).text(pdfSafe(title));
  doc.moveDown(0.2).fillColor(PDF_COLORS.muted).font("Helvetica").fontSize(9).text(pdfSafe(subtitle));
  doc.moveDown(1);
  return doc;
}

export function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 40);
  doc.moveDown(0.6).fillColor(PDF_COLORS.text).font("Helvetica-Bold").fontSize(12).text(pdfSafe(title), doc.page.margins.left);
  doc.moveDown(0.3);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

/** Simple zebra table with header repeat on page breaks. */
export function drawTable(doc: PDFKit.PDFDocument, columns: PdfColumn[], rows: string[][]) {
  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalWeight = columns.reduce((s, c) => s + c.width, 0);
  const widths = columns.map((c) => (c.width / totalWeight) * usable);
  const pad = 4;
  const rowH = 16;

  const drawHeader = () => {
    ensureSpace(doc, rowH * 2);
    const y = doc.y;
    doc.rect(left, y, usable, rowH).fill(PDF_COLORS.border);
    let x = left;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(PDF_COLORS.text);
    columns.forEach((c, i) => {
      doc.text(pdfSafe(c.header), x + pad, y + 4, { width: widths[i]! - pad * 2, align: c.align ?? "left", lineBreak: false, ellipsis: true });
      x += widths[i]!;
    });
    doc.y = y + rowH;
  };

  drawHeader();
  rows.forEach((row, r) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (r % 2 === 1) doc.rect(left, y, usable, rowH).fill(PDF_COLORS.zebra);
    let x = left;
    doc.font("Helvetica").fontSize(8);
    columns.forEach((c, i) => {
      const value = pdfSafe(row[i]);
      doc.fillColor(c.color?.(row[i] ?? "") ?? PDF_COLORS.text);
      doc.text(value, x + pad, y + 4, { width: widths[i]! - pad * 2, align: c.align ?? "left", lineBreak: false, ellipsis: true });
      x += widths[i]!;
    });
    doc.y = y + rowH;
  });
  doc.x = left;
}

/** Footer with page numbers — call right before doc.end(). */
export function addPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // allow writing in the margin
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(PDF_COLORS.muted)
      .text(`Trading Journal  -  page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 28, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
      });
    doc.page.margins.bottom = bottom;
  }
}

export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    addPageNumbers(doc);
    doc.end();
  });
}
