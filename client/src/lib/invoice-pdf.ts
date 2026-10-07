import { jsPDF } from "jspdf";
import type { Invoice, Settings } from "@shared/schema";
import { getInvoicePaymentMethods } from "@shared/payment-methods";
import { getPlan } from "@shared/subscription-features";

export function invoicePdfFilename(invoiceNumber: string) {
  return `Invoice-${invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "download"}.pdf`;
}

export function createInvoicePdf(invoice: Invoice, clientName: string, settings?: Settings) {
  const amount = Number(invoice.amount);
  if (!Number.isFinite(amount)) throw new Error("Invalid invoice amount");
  const currency = settings?.currency || "£";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 24;
  if (getPlan(settings) === "free") {
    // The same open-bowl P and orange terminal as the site's vector brand mark.
    const x = 20, top = 12, scale = 0.12;
    const point = (a: number, b: number) => [x + a * scale, top + b * scale];
    doc.setDrawColor(76, 29, 149);
    doc.setLineWidth(16 * scale);
    doc.setLineCap("round");
    doc.setLineJoin("round");
    doc.path([
      { op: "m", c: point(30, 86) },
      { op: "l", c: point(30, 14) },
      { op: "l", c: point(58, 14) },
      { op: "c", c: [...point(76, 14), ...point(87, 25), ...point(87, 41)] },
      { op: "c", c: [...point(87, 55), ...point(78, 64), ...point(63, 66)] },
    ]).stroke();
    doc.setFillColor(249, 115, 22);
    doc.circle(x + 63 * scale, top + 66 * scale, 10 * scale, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(35, 35, 35);
    doc.text("Practably", 35, 21);
    y = 39;
  }
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join("/") : value;
  const text = (value: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(value, 170);
    for (const line of lines) {
      if (y > 272) { doc.addPage(); y = 24; }
      doc.text(line, 20, y);
      y += size > 15 ? 10 : 6;
    }
  };
  // Text, not interpolated HTML: customer-entered content cannot execute.
  doc.setTextColor(91, 33, 182);
  text("INVOICE", 24, true);
  doc.setTextColor(35, 35, 35);
  text(`Invoice number: ${invoice.invoiceNumber}`, 12, true);
  text(`Status: ${invoice.status || "pending"}`);
  y += 6;
  text(settings?.businessName || settings?.trainerName || "Coach", 16, true);
  for (const value of [settings?.trainerName, settings?.trainerEmail, settings?.trainerPhone, settings?.businessAddress]) {
    if (value) text(value);
  }
  y += 6;
  text("Bill to", 12, true);
  text(clientName);
  if (invoice.sentDate) text(`Sent: ${date(invoice.sentDate)}`);
  text(`Due: ${date(invoice.dueDate)}`);
  if (invoice.paidDate) text(`Paid: ${date(invoice.paidDate)}`);
  y += 6;
  text("Description", 12, true);
  text(invoice.notes || "Coaching sessions");
  y += 6;
  text(`${invoice.status === "paid" ? "Amount paid" : "Total due"}: ${currency}${amount.toFixed(2)}`, 16, true);
  const methods = getInvoicePaymentMethods(settings, invoice.paymentMethod);
  if (methods.length) {
    y += 8;
    text("Ways to pay", 12, true);
    for (const method of methods) {
      text([method.label, method.detail, method.link].filter(Boolean).join(": "));
    }
  }
  y += 8;
  text("Thank you for your business.", 10);
  text(`Generated: ${date(new Date().toISOString().slice(0, 10))}`, 10);
  doc.setProperties({ title: `Invoice ${invoice.invoiceNumber}` });
  return doc;
}

export async function downloadInvoicePdf(invoice: Invoice, clientName: string, settings?: Settings) {
  await createInvoicePdf(invoice, clientName, settings).save(invoicePdfFilename(invoice.invoiceNumber), { returnPromise: true });
}