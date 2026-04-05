// ============================================================
// Server-side rent receipt PDF generator
// ============================================================
//
// Uses pdf-lib (pure JS, Deno-compatible via esm.sh) to draw a
// branded receipt for any payment row. No HTML, no Chromium,
// no external API keys.
//
// Layout mirrors the fields in lib/pdf.ts but is laid out with
// pdf-lib primitives (rects + text). Output goes to the same
// `receipts/{payment_id}.pdf` path as client-cached PDFs so both
// sources feed the same Telegram bot lookup.
// ============================================================

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'https://esm.sh/pdf-lib@1.17.1';

interface ReceiptPaymentLike {
  id: string;
  month: number;
  year: number;
  amount_due: number;
  amount_paid: number;
  status: string;
  paid_at: string | null;
  confirmed_at: string | null;
  due_date: string;
  notes: string | null;
}

interface ReceiptTenantLike {
  tenant_name: string;
  flat_no: string;
  monthly_rent: number;
  lease_start: string;
  lease_end: string | null;
}

interface ReceiptPropertyLike {
  name: string;
  address: string | null;
  city: string | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Brand colors (match lib/pdf.ts HTML template)
const TEAL = rgb(0, 0.588, 0.533);   // #009688
const SLATE_900 = rgb(0.118, 0.161, 0.231); // #1e293b
const SLATE_600 = rgb(0.392, 0.455, 0.545); // #64748b
const SLATE_400 = rgb(0.580, 0.639, 0.722); // #94a3b8
const SLATE_200 = rgb(0.886, 0.910, 0.941); // #e2e8f0
const SLATE_100 = rgb(0.945, 0.961, 0.976); // #f1f5f9
const WHITE = rgb(1, 1, 1);

// Status pill colors
const STATUS_COLORS: Record<string, { bg: [number, number, number]; fg: [number, number, number] }> = {
  confirmed: { bg: [0.820, 0.980, 0.898], fg: [0.024, 0.373, 0.275] },
  paid: { bg: [0.859, 0.922, 0.996], fg: [0.118, 0.251, 0.686] },
  partial: { bg: [0.996, 0.953, 0.780], fg: [0.573, 0.251, 0.055] },
  pending: { bg: [0.945, 0.961, 0.976], fg: [0.278, 0.333, 0.412] },
  overdue: { bg: [0.996, 0.894, 0.894], fg: [0.600, 0.102, 0.102] },
};

function formatCurrency(amount: number): string {
  // INR formatting with Indian grouping (e.g. 1,23,456)
  // pdf-lib's default font doesn't support ₹ glyph, so use "Rs." prefix.
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `Rs. ${formatted}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthName(m: number): string {
  return MONTH_NAMES[m - 1] ?? String(m);
}

// ----------------------------------------------------------------
// Drawing helpers — layered on top of pdf-lib's low-level API so
// the main builder reads closer to a layout description than a
// pile of coordinate math.
// ----------------------------------------------------------------

interface DrawContext {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  pageWidth: number;
  pageHeight: number;
}

function drawText(
  ctx: DrawContext,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number } = {},
) {
  const size = opts.size ?? 11;
  const font = opts.bold ? ctx.bold : ctx.font;
  const color = opts.color ?? SLATE_900;
  // Truncate overly long text to avoid overflow
  let value = text;
  if (opts.maxWidth) {
    while (value.length > 1 && font.widthOfTextAtSize(value, size) > opts.maxWidth) {
      value = value.slice(0, -1);
    }
    if (value !== text) value = value.slice(0, -1) + '…';
  }
  ctx.page.drawText(value, { x, y, size, font, color });
}

function drawField(ctx: DrawContext, label: string, value: string, x: number, y: number, width: number) {
  drawText(ctx, label.toUpperCase(), x, y, { size: 8, color: SLATE_600 });
  drawText(ctx, value, x, y - 14, { size: 11, bold: true, color: SLATE_900, maxWidth: width });
}

function drawStatusPill(
  ctx: DrawContext,
  status: string,
  x: number,
  y: number,
) {
  const key = status.toLowerCase();
  const colors = STATUS_COLORS[key] ?? STATUS_COLORS.pending;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const textWidth = ctx.bold.widthOfTextAtSize(label, 10);
  const pillWidth = textWidth + 20;
  const pillHeight = 20;

  ctx.page.drawRectangle({
    x,
    y: y - 4,
    width: pillWidth,
    height: pillHeight,
    color: rgb(colors.bg[0], colors.bg[1], colors.bg[2]),
    borderColor: rgb(colors.bg[0], colors.bg[1], colors.bg[2]),
  });
  ctx.page.drawText(label, {
    x: x + 10,
    y: y + 2,
    size: 10,
    font: ctx.bold,
    color: rgb(colors.fg[0], colors.fg[1], colors.fg[2]),
  });
}

// ----------------------------------------------------------------
// Main builder
// ----------------------------------------------------------------

export async function buildReceiptPdf(
  payment: ReceiptPaymentLike,
  tenant: ReceiptTenantLike,
  property: ReceiptPropertyLike,
  landlordName: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Rent Receipt - ${tenant.tenant_name} - ${monthName(payment.month)} ${payment.year}`);
  pdfDoc.setAuthor('Dwella');
  pdfDoc.setCreator('Dwella Bot');

  const page = pdfDoc.addPage([595, 842]); // A4 portrait
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ctx: DrawContext = { page, font, bold, pageWidth: width, pageHeight: height };

  // ── Header band (teal) ──
  const headerHeight = 110;
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: headerHeight,
    color: TEAL,
  });

  // Logo wordmark (simple typographic — no SVG embed so we keep
  // the function self-contained and fast)
  drawText(ctx, 'Dwella', 40, height - 50, { size: 32, bold: true, color: WHITE });
  drawText(ctx, 'Rental Property Management', 40, height - 72, { size: 10, color: WHITE });

  // Right side — title + period + receipt id
  const rightX = width - 40;
  const title = 'Rent Payment Receipt';
  const titleWidth = bold.widthOfTextAtSize(title, 16);
  drawText(ctx, title, rightX - titleWidth, height - 46, { size: 16, bold: true, color: WHITE });

  const period = `${monthName(payment.month)} ${payment.year}`;
  const periodWidth = bold.widthOfTextAtSize(period, 13);
  drawText(ctx, period, rightX - periodWidth, height - 66, { size: 13, bold: true, color: WHITE });

  const receiptId = `Receipt #${payment.id.slice(0, 8).toUpperCase()}`;
  const rIdWidth = font.widthOfTextAtSize(receiptId, 9);
  drawText(ctx, receiptId, rightX - rIdWidth, height - 82, { size: 9, color: WHITE });

  const generated = `Generated: ${formatDate(new Date().toISOString())}`;
  const genWidth = font.widthOfTextAtSize(generated, 9);
  drawText(ctx, generated, rightX - genWidth, height - 94, { size: 9, color: WHITE });

  // ── Property details section ──
  let y = height - headerHeight - 40;
  drawText(ctx, 'PROPERTY DETAILS', 40, y, { size: 9, bold: true, color: SLATE_400 });
  y -= 22;

  const col1X = 40;
  const col2X = 320;
  const colWidth = 235;

  drawField(ctx, 'Property', property.name, col1X, y, colWidth);
  const addr = [property.address, property.city].filter(Boolean).join(', ') || '—';
  drawField(ctx, 'Address', addr, col2X, y, colWidth);
  y -= 36;

  drawField(ctx, 'Landlord', landlordName || '—', col1X, y, colWidth);
  drawField(ctx, 'Flat / Unit', tenant.flat_no || '—', col2X, y, colWidth);
  y -= 44;

  // Divider
  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 0.5,
    color: SLATE_200,
  });
  y -= 24;

  // ── Tenant details ──
  drawText(ctx, 'TENANT DETAILS', 40, y, { size: 9, bold: true, color: SLATE_400 });
  y -= 22;

  drawField(ctx, 'Tenant Name', tenant.tenant_name, col1X, y, colWidth);
  drawField(ctx, 'Monthly Rent', formatCurrency(tenant.monthly_rent), col2X, y, colWidth);
  y -= 36;

  drawField(ctx, 'Lease Start', formatDate(tenant.lease_start), col1X, y, colWidth);
  drawField(ctx, 'Lease End', tenant.lease_end ? formatDate(tenant.lease_end) : '—', col2X, y, colWidth);
  y -= 44;

  // Divider
  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 0.5,
    color: SLATE_200,
  });
  y -= 24;

  // ── Payment details ──
  drawText(ctx, 'PAYMENT DETAILS', 40, y, { size: 9, bold: true, color: SLATE_400 });
  y -= 18;

  // Amount box
  const boxTop = y;
  const boxHeight = 100;
  page.drawRectangle({
    x: 40,
    y: boxTop - boxHeight,
    width: width - 80,
    height: boxHeight,
    color: SLATE_100,
  });

  const boxPadX = 56;
  let rowY = boxTop - 22;
  const remainingBalance = payment.amount_due - payment.amount_paid;

  drawText(ctx, 'Amount Due', boxPadX, rowY, { size: 11, color: SLATE_600 });
  const due = formatCurrency(payment.amount_due);
  drawText(ctx, due, width - 40 - boxPadX + 40 - bold.widthOfTextAtSize(due, 11), rowY, { size: 11, bold: true });
  rowY -= 18;

  drawText(ctx, 'Amount Paid', boxPadX, rowY, { size: 11, color: SLATE_600 });
  const paid = formatCurrency(payment.amount_paid);
  drawText(ctx, paid, width - 40 - boxPadX + 40 - bold.widthOfTextAtSize(paid, 11), rowY, { size: 11, bold: true });
  rowY -= 18;

  if (remainingBalance > 0) {
    drawText(ctx, 'Remaining Balance', boxPadX, rowY, { size: 11, color: SLATE_600 });
    const bal = formatCurrency(remainingBalance);
    drawText(ctx, bal, width - 40 - boxPadX + 40 - bold.widthOfTextAtSize(bal, 11), rowY, {
      size: 11,
      bold: true,
      color: rgb(0.6, 0.1, 0.1),
    });
    rowY -= 18;
  }

  // Separator line inside the box
  page.drawLine({
    start: { x: boxPadX, y: rowY + 6 },
    end: { x: width - boxPadX, y: rowY + 6 },
    thickness: 0.5,
    color: SLATE_200,
  });
  rowY -= 6;

  drawText(ctx, 'Status', boxPadX, rowY - 4, { size: 11, bold: true });
  drawStatusPill(ctx, payment.status, width - 40 - boxPadX - 10, rowY - 8);

  y = boxTop - boxHeight - 24;

  // Timeline row
  const dueDateStr = formatDate(payment.due_date);
  drawField(ctx, 'Due Date', dueDateStr, col1X, y, colWidth);
  if (payment.paid_at) {
    drawField(ctx, 'Paid On', formatDate(payment.paid_at), col2X, y, colWidth);
    y -= 36;
  } else {
    y -= 36;
  }
  if (payment.confirmed_at) {
    drawField(ctx, 'Confirmed On', formatDate(payment.confirmed_at), col1X, y, colWidth);
    y -= 36;
  }

  // Notes
  if (payment.notes) {
    drawText(ctx, 'NOTES', 40, y, { size: 9, bold: true, color: SLATE_400 });
    y -= 14;
    drawText(ctx, payment.notes, 40, y, { size: 10, color: SLATE_900, maxWidth: width - 80 });
    y -= 20;
  }

  // Footer
  const footer = 'Generated by Dwella — Rental Property Management';
  const footerWidth = font.widthOfTextAtSize(footer, 9);
  drawText(ctx, footer, (width - footerWidth) / 2, 40, { size: 9, color: SLATE_400 });

  const bytes = await pdfDoc.save();
  return bytes;
}
