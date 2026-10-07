import type { Invoice } from '@/types'
import { formatDate, inr, labelOf } from '@/utils/format'

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pdfText(value: string) {
  return value
    .replace(/\u20b9/g, 'Rs. ')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function money(value?: number) {
  return inr(value).replace(/\u20b9/g, 'Rs. ').replace(/[\u00a0\u202f]/g, ' ')
}

export function invoiceHtml(invoice: Invoice) {
  const garage = invoice.garage
  const rows = invoice.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.kind === 'part' ? `${item.sku || 'Part'} · ${item.name}` : item.name)}</td>
      <td>${escapeHtml(item.kind === 'part' ? 'Part' : 'Labour')}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${escapeHtml(inr(item.unitPrice))}</td>
      <td class="num">${escapeHtml(inr(item.lineTotal))}</td>
    </tr>`).join('')
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @page { margin: 14mm; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #12232c; }
    h1 { margin: 0; font-size: 22px; }
    .muted { color: #5c727c; }
    .top { display: flex; justify-content: space-between; gap: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; }
    th { text-align: left; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #5c727c; border-bottom: 2px solid #14627a; padding: 8px 6px; }
    td { border-bottom: 1px solid #e4edf1; padding: 8px 6px; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-left: auto; margin-top: 16px; width: 260px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .grand { font-size: 16px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>${escapeHtml(garage?.garageName || 'Apex Motors')}</h1>
      <p class="muted">${escapeHtml([garage?.address, garage?.city].filter(Boolean).join(', ') || '')}<br>${escapeHtml(garage?.phone || '')}${garage?.gstin ? `<br>GSTIN ${escapeHtml(garage.gstin)}` : ''}</p>
    </div>
    <div>
      <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
      <p class="muted">Issued ${escapeHtml(formatDate(invoice.issuedAt))}<br>Due ${escapeHtml(formatDate(invoice.dueDate))}<br>${escapeHtml(labelOf(invoice.status))}</p>
    </div>
  </div>
  <p><strong>${escapeHtml(invoice.customerName)}</strong><br><span class="muted">${escapeHtml(invoice.vehicleLabel || '')}${invoice.requestNumber ? `<br>Job ${escapeHtml(invoice.requestNumber)}` : ''}</span></p>
  <table>
    <thead><tr><th>Description</th><th>Type</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${escapeHtml(inr(invoice.subtotal))}</span></div>
    <div><span>Discount</span><span>${escapeHtml(inr(invoice.discount))}</span></div>
    <div><span>GST ${invoice.taxRate}%</span><span>${escapeHtml(inr(invoice.taxAmount))}</span></div>
    <div class="grand"><span>Total</span><span>${escapeHtml(inr(invoice.total))}</span></div>
    <div><span>Paid</span><span>${escapeHtml(inr(invoice.amountPaid))}</span></div>
    <div class="grand"><span>Balance</span><span>${escapeHtml(inr(invoice.balance))}</span></div>
  </div>
</body>
</html>`
}

function pdfPages(invoice: Invoice) {
  const garage = invoice.garage
  const pages: string[][] = [[]]
  const header = () => {
    const page = pages[pages.length - 1]
    page.push('18 Tf 1 0 0 1 48 800 Tm (' + pdfText(garage?.garageName || 'Apex Motors') + ') Tj')
    page.push('11 Tf 1 0 0 1 48 780 Tm (' + pdfText([garage?.address, garage?.city].filter(Boolean).join(', ')) + ') Tj')
    page.push('11 Tf 1 0 0 1 48 764 Tm (' + pdfText(`${garage?.phone || ''}${garage?.gstin ? `   GSTIN ${garage.gstin}` : ''}`) + ') Tj')
    page.push('14 Tf 1 0 0 1 380 800 Tm (' + pdfText(invoice.invoiceNumber) + ') Tj')
    page.push('11 Tf 1 0 0 1 380 780 Tm (' + pdfText(`Issued ${formatDate(invoice.issuedAt)}`) + ') Tj')
    page.push('11 Tf 1 0 0 1 380 764 Tm (' + pdfText(`Due ${formatDate(invoice.dueDate)}`) + ') Tj')
    page.push('11 Tf 1 0 0 1 380 748 Tm (' + pdfText(labelOf(invoice.status)) + ') Tj')
    page.push('12 Tf 1 0 0 1 48 710 Tm (' + pdfText(invoice.customerName) + ') Tj')
    page.push('11 Tf 1 0 0 1 48 694 Tm (' + pdfText(invoice.vehicleLabel || '') + ') Tj')
    if (invoice.requestNumber) page.push('11 Tf 1 0 0 1 48 678 Tm (' + pdfText(`Job ${invoice.requestNumber}`) + ') Tj')
    page.push('10 Tf 1 0 0 1 48 650 Tm (Description) Tj')
    page.push('10 Tf 1 0 0 1 330 650 Tm (Type) Tj')
    page.push('10 Tf 1 0 0 1 400 650 Tm (Qty) Tj')
    page.push('10 Tf 1 0 0 1 450 650 Tm (Rate) Tj')
    page.push('10 Tf 1 0 0 1 510 650 Tm (Amount) Tj')
  }
  header()
  let y = 628
  const ensure = () => {
    if (y >= 72) return
    pages.push([])
    header()
    y = 628
  }
  for (const item of invoice.items) {
    ensure()
    const name = (item.kind === 'part' ? `${item.sku || 'Part'} · ${item.name}` : item.name).slice(0, 42)
    const page = pages[pages.length - 1]
    page.push(`11 Tf 1 0 0 1 48 ${y} Tm (${pdfText(name)}) Tj`)
    page.push(`11 Tf 1 0 0 1 330 ${y} Tm (${pdfText(item.kind === 'part' ? 'Part' : 'Labour')}) Tj`)
    page.push(`11 Tf 1 0 0 1 400 ${y} Tm (${item.quantity}) Tj`)
    page.push(`11 Tf 1 0 0 1 450 ${y} Tm (${pdfText(money(item.unitPrice))}) Tj`)
    page.push(`11 Tf 1 0 0 1 510 ${y} Tm (${pdfText(money(item.lineTotal))}) Tj`)
    y -= 18
  }
  y -= 12
  const totals = [
    ['Subtotal', money(invoice.subtotal)],
    ['Discount', money(invoice.discount)],
    [`GST ${invoice.taxRate}%`, money(invoice.taxAmount)],
    ['Total', money(invoice.total)],
    ['Paid', money(invoice.amountPaid)],
    ['Balance', money(invoice.balance)],
  ]
  for (const [label, value] of totals) {
    ensure()
    const page = pages[pages.length - 1]
    page.push(`11 Tf 1 0 0 1 380 ${y} Tm (${pdfText(label)}) Tj`)
    page.push(`11 Tf 1 0 0 1 480 ${y} Tm (${pdfText(value)}) Tj`)
    y -= 16
  }
  return pages.map((commands) => `BT /F1 ${commands.join(' ')} ET`)
}

export function invoicePdf(invoice: Invoice) {
  const streams = pdfPages(invoice)
  const objects: { id: number; body: string }[] = [
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
  ]
  const kids: string[] = []
  let nextId = 4
  for (const stream of streams) {
    const contentId = nextId
    const pageId = nextId + 1
    nextId += 2
    kids.push(`${pageId} 0 R`)
    const data = `${stream}\n`
    objects.push({ id: contentId, body: `<< /Length ${data.length} >>\nstream\n${data}endstream` })
    objects.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    })
  }
  objects.push({ id: 2, body: `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>` })
  objects.sort((a, b) => a.id - b.id)

  let file = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) {
    offsets[object.id] = file.length
    file += `${object.id} 0 obj\n${object.body}\nendobj\n`
  }
  const xref = file.length
  file += `xref\n0 ${objects.length + 1}\n`
  file += '0000000000 65535 f \n'
  for (let id = 1; id <= objects.length; id += 1) {
    file += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([file], { type: 'application/pdf' })
}

export function downloadInvoiceFile(invoice: Invoice) {
  const blob = invoicePdf(invoice)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoice.invoiceNumber}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

export function printInvoice(invoice: Invoice) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    return
  }
  doc.open()
  doc.write(invoiceHtml(invoice))
  doc.close()
  const cleanup = () => frame.remove()
  win.addEventListener('afterprint', cleanup)
  window.setTimeout(() => {
    win.focus()
    win.print()
  }, 200)
}
