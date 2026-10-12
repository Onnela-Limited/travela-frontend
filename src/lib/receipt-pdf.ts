import { jsPDF } from 'jspdf';

export interface ReceiptPdfData {
  orderId: number;
  brand: string;
  merchant: string;
  tin: string;
  address: string;
  status: string;
  date: string;
  items: { description: string; amount: string }[];
  total: string;
  vat: string;
  vatRate: string;
  orderReference: string;
  paymentId: string;
}

/** Generate a real PDF independently of the receipt modal's scroll position. */
export function createReceiptPdf(receipt: ReceiptPdfData): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;

  pdf.setProperties({ title: `${receipt.brand} receipt ${receipt.orderId}` });

  function text(value: string, size = 11, bold = false) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(value, width);
    const lineHeight = size * 0.45;
    for (const line of lines) {
      if (y + lineHeight > bottom) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    y += 2;
  }

  function divider() {
    if (y + 8 > bottom) {
      pdf.addPage();
      y = margin;
    }
    pdf.setDrawColor(220, 225, 220);
    pdf.line(margin, y, margin + width, y);
    y += 8;
  }

  text(receipt.brand, 22, true);
  text('Receipt', 16, true);
  text(receipt.status, 11, true);
  text(receipt.date);
  divider();
  text(receipt.merchant, 12, true);
  text(`TIN: ${receipt.tin}`);
  text(receipt.address);
  divider();
  if (receipt.items.length === 0) text('No line items on this order.');
  for (const item of receipt.items) {
    text(item.description);
    text(item.amount, 11, true);
  }
  divider();
  text(`Total: ${receipt.total}`, 14, true);
  text(`Incl. VAT: ${receipt.vat}`);
  text(`VAT rate: ${receipt.vatRate}`);
  divider();
  text(`Order ref: ${receipt.orderReference}`);
  text(`Payment ID: ${receipt.paymentId}`);
  return pdf;
}
