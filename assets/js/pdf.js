/* =========================================================================
   Minimal PDF writer
   ---------------------------------------------------------------------------
   No dependency, no CDN, no build step: this hand-writes just enough of the
   PDF 1.4 object model (catalog, pages, a Helvetica text stream) to produce a
   real, valid, downloadable PDF from the browser. It intentionally does not
   attempt vector graphics, embedded fonts or images — a price quote is text
   and rules, and the standard 14 fonts (Helvetica) need no embedding at all.
   ========================================================================= */

const PAGE_W = 595.28;  // A4 in points
const PAGE_H = 841.89;
const MARGIN = 50;

/** WinAnsiEncoding covers Latin-1, so Spanish diacritics map 1:1 by code point. */
function pdfEscape(text) {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`;
    else if (code <= 255) out += ch;
    else out += '?';
  }
  return out;
}

export class PdfDoc {
  constructor() {
    this.pages = [];
    this._newPage();
  }

  _newPage() {
    this.page = { ops: [] };
    this.pages.push(this.page);
    this.y = PAGE_H - MARGIN;
  }

  /** Advance to a new page if the next line would overflow the bottom margin. */
  _ensureRoom(lineHeight = 16) {
    if (this.y - lineHeight < MARGIN) this._newPage();
  }

  text(str, { x = MARGIN, size = 11, bold = false, color = [0.06, 0.1, 0.16], gap = 16 } = {}) {
    this._ensureRoom(gap);
    const font = bold ? '/F2' : '/F1';
    const [r, g, b] = color;
    this.page.ops.push(
      `q ${r} ${g} ${b} rg BT ${font} ${size} Tf ${x} ${this.y.toFixed(2)} Td (${pdfEscape(str)}) Tj ET Q`,
    );
    this.y -= gap;
  }

  rule({ color = [0.85, 0.87, 0.92] } = {}) {
    this._ensureRoom(10);
    const [r, g, b] = color;
    this.page.ops.push(`q ${r} ${g} ${b} RG 0.75 w ${MARGIN} ${this.y.toFixed(2)} m ${PAGE_W - MARGIN} ${this.y.toFixed(2)} l S Q`);
    this.y -= 10;
  }

  row(left, right, { size = 11, bold = false, gap = 16, color } = {}) {
    this._ensureRoom(gap);
    const rightWidth = right.length * size * 0.52;
    this.text(left, { size, bold, gap: 0, color });
    this.text(right, { x: PAGE_W - MARGIN - rightWidth, size, bold, gap: 0, color });
    this.y -= gap;
  }

  space(n = 8) { this.y -= n; }

  /** Build the PDF byte stream and return it as a Blob. */
  build() {
    // Object ids are assigned up front (fonts, then one content stream per
    // page, then one page object per page, then Pages, then Catalog) so each
    // object can reference the ids it needs without a forward-reference patch.
    const n = this.pages.length;
    const fontRegularId = 1;
    const fontBoldId = 2;
    const contentIds = Array.from({ length: n }, (_, i) => 3 + i);
    const pageIds = Array.from({ length: n }, (_, i) => 3 + n + i);
    const pagesId = 3 + 2 * n;
    const catalogId = 4 + 2 * n;

    const objects = [];
    objects[fontRegularId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[fontBoldId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    this.pages.forEach((page, i) => {
      const stream = page.ops.join('\n');
      objects[contentIds[i] - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    this.pages.forEach((_, i) => {
      objects[pageIds[i] - 1] =
        `<< /Type /Page /Parent ${pagesId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
        `/MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentIds[i]} 0 R >>`;
    });
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${n} >>`;
    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    // Every char in `pdf` is already clamped to a single byte (pdfEscape maps
    // anything above code point 255 to '?'), so a 1:1 char→byte transcription
    // is exact. This matters: a Blob built straight from the JS string would
    // have Spanish diacritics re-encoded as multi-byte UTF-8, which silently
    // breaks both WinAnsiEncoding's single-byte text and the xref byte offsets
    // computed above from `.length` (a UTF-16 code-unit count, not bytes).
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;

    return new Blob([bytes], { type: 'application/pdf' });
  }
}

/**
 * A one-page price quote: brand header, client + vehicle summary, itemised
 * cost breakdown and total. Returns a Blob ready for downloadBlob().
 */
export function buildQuotePdf({ brandName, lang = 'es', client, vehicle, lines, total, maxBid, quoteId, issuedAt }) {
  const en = lang === 'en';
  const doc = new PdfDoc();

  doc.text(brandName, { size: 20, bold: true, gap: 26 });
  doc.text(en ? 'Purchase cost quote' : 'Cotización de costo de compra', { size: 12, color: [0.4, 0.44, 0.52], gap: 22 });
  doc.rule();
  doc.space(6);

  doc.row(en ? 'Quote #' : 'Cotización #', quoteId, { size: 10, color: [0.4, 0.44, 0.52] });
  doc.row(en ? 'Issued' : 'Emitida', issuedAt, { size: 10, color: [0.4, 0.44, 0.52] });
  doc.space(10);

  if (client) {
    doc.text(en ? 'Client' : 'Cliente', { size: 11, bold: true, gap: 16 });
    doc.text(client, { size: 11, gap: 18 });
  }
  if (vehicle) {
    doc.text(en ? 'Vehicle' : 'Vehículo', { size: 11, bold: true, gap: 16 });
    doc.text(vehicle, { size: 11, gap: 18 });
  }
  doc.space(6);
  doc.rule();
  doc.space(6);

  doc.text(en ? 'Maximum / hammer bid' : 'Puja máxima / de martillo', { size: 11, bold: true, gap: 18 });
  doc.text(maxBid, { size: 14, bold: true, gap: 22 });

  doc.text(en ? 'Cost breakdown' : 'Desglose de costos', { size: 11, bold: true, gap: 18 });
  for (const [label, amount] of lines) doc.row(label, amount, { size: 10.5, gap: 15 });

  doc.space(4);
  doc.rule();
  doc.space(4);
  doc.row(en ? 'TOTAL (all-in)' : 'TOTAL (todo incluido)', total, { size: 13, bold: true, gap: 20 });

  doc.space(14);
  doc.text(en
    ? 'Estimate for planning purposes — fees are auction-published defaults, not a binding offer.'
    : 'Estimado con fines de planificación — las tarifas son valores publicados por la subasta, no una oferta vinculante.',
    { size: 8.5, color: [0.5, 0.54, 0.6], gap: 12 });

  return doc.build();
}
