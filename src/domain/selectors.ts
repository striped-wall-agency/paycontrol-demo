import type {
  Currency,
  Settings,
  Snapshot,
  Transaction,
  TransactionFilters,
} from "./types";
export const money = (amount: number, currency: Currency) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount / 100,
  );
export const utc = (date: string) =>
  new Date(date).toISOString().replace("T", " ").replace(".000Z", " UTC");
export function inPeriod(date: string, start: string, end: string) {
  return (
    date >= `${start}T00:00:00.000Z` &&
    date < new Date(Date.parse(`${end}T00:00:00.000Z`) + 86400000).toISOString()
  );
}
export function validateRange(start: string, end: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    start > end
  )
    throw new Error("Choose a valid start date on or before the end date.");
}
export function filterTransactions(rows: Transaction[], f: TransactionFilters) {
  validateRange(f.start, f.end);
  const min = f.min === "" ? 0 : Number(f.min),
    max = f.max === "" ? Infinity : Number(f.max);
  if (!Number.isFinite(min) || min < 0 || Number.isNaN(max) || max < min)
    throw new Error(
      "Amounts must be positive and minimum cannot exceed maximum.",
    );
  const q = f.search.trim().toLowerCase();
  return rows
    .filter(
      (t) =>
        inPeriod(t.createdAt, f.start, f.end) &&
        (f.currency === "All" || t.currency === f.currency) &&
        (f.status === "All" || t.status === f.status) &&
        (f.source === "All" || t.source === f.source) &&
        t.amount >= Math.round(min * 100) &&
        t.amount <= Math.round(max * 100) &&
        [t.id, t.providerRef, t.orderId, t.customer, t.email].some((v) =>
          v.toLowerCase().includes(q),
        ),
    )
    .sort((a, b) => {
      const delta =
        f.sort === "amount"
          ? a.amount - b.amount
          : f.sort === "status"
            ? a.status.localeCompare(b.status)
            : a.createdAt.localeCompare(b.createdAt);
      return (
        (f.direction === "asc" ? delta : -delta) || a.id.localeCompare(b.id)
      );
    });
}
export function metrics(s: Snapshot, settings: Settings) {
  const tx = s.transactions.filter(
    (t) =>
      inPeriod(t.createdAt, settings.start, settings.end) &&
      (settings.currency === "All" || t.currency === settings.currency),
  );
  const refunds = s.refunds.filter(
    (r) =>
      r.status === "Succeeded" &&
      inPeriod(r.createdAt, settings.start, settings.end) &&
      (settings.currency === "All" || r.currency === settings.currency),
  );
  const results = s.results.filter(
    (r) =>
      r.accountingDate >= settings.start &&
      r.accountingDate <= settings.end &&
      (settings.currency === "All" ||
        [...r.internal, ...r.provider].some(
          (v) => v.currency === settings.currency,
        )),
  );
  return {
    tx,
    refunds,
    results,
    attempts: tx.length,
    rate: tx.length
      ? tx.filter((t) => t.status === "Succeeded").length / tx.length
      : null,
    open: results.filter(
      (r) => r.categories.length && r.reviewState !== "Resolved",
    ).length,
    volumes: totals(tx.filter((t) => t.status === "Succeeded")),
    refundVolumes: totals(refunds),
  };
}
export function totals(rows: { amount: number; currency: Currency }[]) {
  return (["USD", "EUR"] as const).map((currency) => ({
    currency,
    amount: rows
      .filter((t) => t.currency === currency)
      .reduce((sum, t) => sum + t.amount, 0),
  }));
}
export function csv(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^\s*[=+@-]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
