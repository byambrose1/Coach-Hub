import type { Client, Invoice, Package } from "@shared/schema";

function money(value: string | null | undefined): number {
  if (!value) return 0;
  const amount = Number(value.replace(/[£,\s]/g, ""));
  if (!Number.isFinite(amount)) throw new Error("Invalid revenue amount");
  return Math.round(amount * 100);
}

export function revenueReport(
  invoices: Invoice[], packages: Package[], clients: Client[],
  from: string, to: string, advanced: boolean, clientId?: string,
) {
  const selectedInvoices = invoices.filter(invoice => !clientId || invoice.clientId === clientId);
  const selectedPackages = packages.filter(pkg => !clientId || pkg.clientId === clientId);
  const packageMap = new Map(packages.map(pkg => [pkg.id, pkg]));
  const paid = selectedInvoices.filter(invoice =>
    invoice.status === "paid" && !!invoice.paidDate &&
    invoice.paidDate >= from && invoice.paidDate <= to,
  );
  const pending = selectedInvoices.filter(invoice =>
    ["pending", "sent", "overdue"].includes(invoice.status || "pending"),
  );
  const monthly = paid.filter(invoice => invoice.packageId &&
    packageMap.get(invoice.packageId)?.billingType === "monthly");
  const total = paid.reduce((sum, invoice) => sum + money(invoice.amount), 0);
  const monthlyTotal = monthly.reduce((sum, invoice) => sum + money(invoice.amount), 0);
  const clientTotals = new Map<string, { invoiceCount: number; cents: number }>();
  if (advanced) for (const invoice of paid) {
    const previous = clientTotals.get(invoice.clientId) || { invoiceCount: 0, cents: 0 };
    clientTotals.set(invoice.clientId, {
      invoiceCount: previous.invoiceCount + 1, cents: previous.cents + money(invoice.amount),
    });
  }
  const names = new Map(clients.map(client => [client.id, client.name]));
  return {
    from, to,
    totalRevenue: total / 100,
    blockRevenue: (total - monthlyTotal) / 100,
    monthlyRevenue: monthlyTotal / 100,
    pendingTotal: pending.reduce((sum, invoice) => sum + money(invoice.amount), 0) / 100,
    pendingCount: pending.length,
    monthlyBilling: selectedPackages.filter(pkg => pkg.status === "active" && pkg.billingType === "monthly")
      .reduce((sum, pkg) => sum + money(pkg.monthlyRate), 0) / 100,
    unallocatedPaidCount: selectedInvoices.filter(invoice => invoice.status === "paid" && !invoice.paidDate).length,
    ...(advanced ? {
      byClient: Array.from(clientTotals).map(([id, value]) => ({
        clientId: id, clientName: names.get(id) || "Archived client",
        invoiceCount: value.invoiceCount, paidTotal: value.cents / 100,
      })).sort((a, b) => b.paidTotal - a.paidTotal),
    } : {}),
  };
}