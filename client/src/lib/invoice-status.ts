import type { Invoice } from "@shared/schema";

const DUE_SOON_DAYS = 3;

export type InvoiceDisplayStatus = "paid" | "overdue" | "due_soon" | "partially_paid" | "sent" | "pending";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function isOverdue(invoice: Invoice): boolean {
  return invoice.status !== "paid" && invoice.dueDate < todayStr();
}

export function isDueSoon(invoice: Invoice): boolean {
  if (invoice.status === "paid" || isOverdue(invoice)) return false;
  return invoice.dueDate <= addDaysStr(todayStr(), DUE_SOON_DAYS);
}

export function getDisplayStatus(invoice: Invoice): InvoiceDisplayStatus {
  if (invoice.status === "paid") return "paid";
  if (isOverdue(invoice)) return "overdue";
  const amountPaid = parseFloat(invoice.amountPaid || "0") || 0;
  if (amountPaid > 0 && amountPaid < (parseFloat(invoice.amount) || 0)) return "partially_paid";
  if (isDueSoon(invoice)) return "due_soon";
  return (invoice.status as InvoiceDisplayStatus) || "pending";
}

export const DISPLAY_STATUS_LABELS: Record<InvoiceDisplayStatus, string> = {
  paid: "Paid",
  overdue: "Overdue",
  due_soon: "Due soon",
  partially_paid: "Partially paid",
  sent: "Sent",
  pending: "Pending",
};
