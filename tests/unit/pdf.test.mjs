import test from 'node:test';
import assert from 'node:assert/strict';
import { PdfDoc, buildQuotePdf } from '../../assets/js/pdf.js';

async function blobText(blob) {
  return Buffer.from(await blob.arrayBuffer()).toString('latin1');
}

test('PdfDoc.build() produces a well-formed single-page PDF', async () => {
  const doc = new PdfDoc();
  doc.text('Hello', { size: 20, bold: true });
  doc.rule();
  doc.row('Left', 'Right');
  const blob = doc.build();
  assert.equal(blob.type, 'application/pdf');
  const text = await blobText(blob);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/Type \/Pages/);
  assert.match(text, /\/Type \/Page[^s]/);
  assert.match(text, /%%EOF$/);
  assert.match(text, /\(Hello\) Tj/);
});

test('PdfDoc paginates once content overflows the page', async () => {
  const doc = new PdfDoc();
  for (let i = 0; i < 80; i++) doc.text(`Line ${i}`, { gap: 16 });
  const blob = doc.build();
  const text = await blobText(blob);
  const pageCount = (text.match(/\/Type \/Page[^s]/g) || []).length;
  assert.ok(pageCount >= 2, `expected pagination, got ${pageCount} page(s)`);
  assert.match(text, /\/Count 2/);
});

test('special characters are escaped so the PDF stream stays valid', async () => {
  const doc = new PdfDoc();
  doc.text('Cost (parens) and a \\ backslash');
  const blob = doc.build();
  const text = await blobText(blob);
  assert.match(text, /\\\(parens\\\)/);
  assert.match(text, /\\\\ backslash/);
});

test('Spanish diacritics survive via WinAnsiEncoding (Latin-1 code points)', async () => {
  const doc = new PdfDoc();
  doc.text('Cotización de comisión — ¡Bienvenido!');
  const blob = doc.build();
  const text = await blobText(blob);
  // WinAnsi maps á/ó/¡ to the same byte values as Latin-1 code points.
  assert.ok(text.includes('Cotización de comisión'));
});

test('buildQuotePdf assembles a real downloadable quote', async () => {
  const blob = buildQuotePdf({
    brandName: 'AuctionAssist',
    lang: 'es',
    client: 'Cliente de prueba',
    vehicle: '2020 Toyota Camry',
    lines: [['Comisión de la subasta', '$500'], ['Transporte', '$650']],
    total: '$7,150',
    maxBid: '$6,000',
    quoteId: 'Q-TEST01',
    issuedAt: '13 de agosto de 2026',
  });
  assert.equal(blob.type, 'application/pdf');
  assert.ok(blob.size > 500);
  const text = await blobText(blob);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /AuctionAssist/);
});
