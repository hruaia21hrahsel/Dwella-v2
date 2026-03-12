import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Payment, Tenant, Property } from './types';
import { formatCurrency, formatDate, getMonthName } from './utils';

function buildReceiptHtml(
  payment: Payment,
  tenant: Tenant,
  property: Property,
  landlordName: string
): string {
  const remainingBalance = payment.amount_due - payment.amount_paid;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 0; color: #1e293b; }
    .header-band { background: #009688; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
    .header-right { text-align: right; }
    .header-title { font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.01em; }
    .header-period { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.85); margin-top: 4px; }
    .header-meta { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 8px; line-height: 1.6; }
    .content { padding: 32px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .section-title { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .field label { font-size: 12px; color: #64748b; display: block; margin-bottom: 2px; }
    .field span { font-size: 14px; font-weight: 500; }
    .amount-box { background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .amount-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .amount-row.total { font-weight: 700; font-size: 16px; border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 12px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-confirmed { background: #d1fae5; color: #065f46; }
    .status-paid { background: #dbeafe; color: #1e40af; }
    .status-partial { background: #fef3c7; color: #92400e; }
    .status-pending { background: #f1f5f9; color: #475569; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header-band">
    <svg viewBox="10 30 180 115" width="160" height="52">
      <text x="18" y="125" font-family="Georgia, serif" font-size="54" font-weight="400" fill="#ffffff" letter-spacing="1">dwe</text>
      <rect x="122" y="74" width="6" height="53" rx="1" fill="#ffffff"/>
      <rect x="142" y="74" width="6" height="53" rx="1" fill="#ffffff"/>
      <path d="M116 76 L135 50 L154 76" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="154" y="125" font-family="Georgia, serif" font-size="54" font-weight="400" fill="#ffffff">a</text>
      <line x1="18" y1="138" x2="185" y2="138" stroke="#ffffff" stroke-width="1.5" opacity="0.3"/>
      <path d="M158 42 L160 36 L162 42 L168 44 L162 46 L160 52 L158 46 L152 44 Z" fill="#F59E0B"/>
      <path d="M168 56 L169 53 L170 56 L173 57 L170 58 L169 61 L168 58 L165 57 Z" fill="#F59E0B" opacity="0.7"/>
      <path d="M148 36 L149 34 L150 36 L152 37 L150 38 L149 40 L148 38 L146 37 Z" fill="#F59E0B" opacity="0.5"/>
    </svg>
    <div class="header-right">
      <div class="header-title">Rent Payment Receipt</div>
      <div class="header-period">${getMonthName(payment.month)} ${payment.year}</div>
      <div class="header-meta">Receipt #${payment.id.slice(0, 8).toUpperCase()}<br/>Generated: ${formatDate(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="content">

  <hr class="divider"/>

  <div class="section-title">Property Details</div>
  <div class="grid">
    <div class="field"><label>Property</label><span>${property.name}</span></div>
    <div class="field"><label>Address</label><span>${property.address}, ${property.city}</span></div>
    <div class="field"><label>Landlord</label><span>${landlordName}</span></div>
    <div class="field"><label>Flat / Unit</label><span>${tenant.flat_no}</span></div>
  </div>

  <hr class="divider"/>

  <div class="section-title">Tenant Details</div>
  <div class="grid">
    <div class="field"><label>Tenant Name</label><span>${tenant.tenant_name}</span></div>
    <div class="field"><label>Monthly Rent</label><span>${formatCurrency(tenant.monthly_rent)}</span></div>
    <div class="field"><label>Lease Start</label><span>${formatDate(tenant.lease_start)}</span></div>
    ${tenant.lease_end ? `<div class="field"><label>Lease End</label><span>${formatDate(tenant.lease_end)}</span></div>` : ''}
  </div>

  <hr class="divider"/>

  <div class="section-title">Payment Details</div>
  <div class="amount-box">
    <div class="amount-row"><span>Amount Due</span><span>${formatCurrency(payment.amount_due)}</span></div>
    <div class="amount-row"><span>Amount Paid</span><span>${formatCurrency(payment.amount_paid)}</span></div>
    ${remainingBalance > 0 ? `<div class="amount-row"><span>Remaining Balance</span><span>${formatCurrency(remainingBalance)}</span></div>` : ''}
    <div class="amount-row total">
      <span>Status</span>
      <span class="status status-${payment.status}">${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span>
    </div>
  </div>

  <div class="grid">
    ${payment.paid_at ? `<div class="field"><label>Paid On</label><span>${formatDate(payment.paid_at)}</span></div>` : ''}
    ${payment.confirmed_at ? `<div class="field"><label>Confirmed On</label><span>${formatDate(payment.confirmed_at)}</span></div>` : ''}
    <div class="field"><label>Due Date</label><span>${formatDate(payment.due_date)}</span></div>
  </div>

  ${payment.notes ? `<div class="field" style="margin-top:16px"><label>Notes</label><span>${payment.notes}</span></div>` : ''}

  <div class="footer">
    Generated by Dwella — Rental Property Management
  </div>

  </div><!-- /.content -->
</body>
</html>`;
}

export async function sharePaymentReceipt(
  payment: Payment,
  tenant: Tenant,
  property: Property,
  landlordName: string
): Promise<void> {
  const html = buildReceiptHtml(payment, tenant, property, landlordName);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Receipt — ${getMonthName(payment.month)} ${payment.year}`,
  });
}

function buildAnnualSummaryHtml(
  payments: Payment[],
  tenant: Tenant,
  property: Property,
  year: number
): string {
  const totalDue = payments.reduce((s, p) => s + p.amount_due, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
  const rows = payments
    .sort((a, b) => a.month - b.month)
    .map(
      (p) => `<tr>
        <td>${getMonthName(p.month)}</td>
        <td>${formatCurrency(p.amount_due)}</td>
        <td>${formatCurrency(p.amount_paid)}</td>
        <td>${formatCurrency(p.amount_due - p.amount_paid)}</td>
        <td><span class="status status-${p.status}">${p.status}</span></td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 32px; color: #1e293b; }
    h2 { margin: 4px 0 24px; font-size: 18px; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .total-row td { font-weight: 700; border-top: 2px solid #e2e8f0; background: #fafafa; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .status-confirmed { background: #d1fae5; color: #065f46; }
    .status-paid { background: #dbeafe; color: #1e40af; }
    .status-partial { background: #fef3c7; color: #92400e; }
    .status-pending { background: #f1f5f9; color: #475569; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <svg viewBox="10 30 180 115" width="160" height="52" style="display:block;margin-bottom:4px">
    <text x="18" y="125" font-family="Georgia, serif" font-size="54" font-weight="400" fill="#009688" letter-spacing="1">dwe</text>
    <rect x="122" y="74" width="6" height="53" rx="1" fill="#009688"/>
    <rect x="142" y="74" width="6" height="53" rx="1" fill="#009688"/>
    <path d="M116 76 L135 50 L154 76" fill="none" stroke="#009688" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="154" y="125" font-family="Georgia, serif" font-size="54" font-weight="400" fill="#009688">a</text>
    <line x1="18" y1="138" x2="185" y2="138" stroke="#009688" stroke-width="1.5" opacity="0.2"/>
    <path d="M158 42 L160 36 L162 42 L168 44 L162 46 L160 52 L158 46 L152 44 Z" fill="#F59E0B"/>
    <path d="M168 56 L169 53 L170 56 L173 57 L170 58 L169 61 L168 58 L165 57 Z" fill="#F59E0B" opacity="0.7"/>
    <path d="M148 36 L149 34 L150 36 L152 37 L150 38 L149 40 L148 38 L146 37 Z" fill="#F59E0B" opacity="0.5"/>
  </svg>
  <h2>Annual Payment Summary — ${year}</h2>
  <p style="font-size:13px;color:#64748b;margin-bottom:16px">
    <strong>${tenant.tenant_name}</strong> · Flat ${tenant.flat_no} · ${property.name}, ${property.city}
  </p>
  <table>
    <thead>
      <tr>
        <th>Month</th><th>Due</th><th>Paid</th><th>Balance</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td>Total</td>
        <td>${formatCurrency(totalDue)}</td>
        <td>${formatCurrency(totalPaid)}</td>
        <td>${formatCurrency(totalDue - totalPaid)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">Generated by Dwella — Rental Property Management</div>
</body>
</html>`;
}

export async function shareAnnualSummary(
  payments: Payment[],
  tenant: Tenant,
  property: Property,
  year: number
): Promise<void> {
  const html = buildAnnualSummaryHtml(payments, tenant, property, year);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Annual Summary ${year} — ${tenant.tenant_name}`,
  });
}
