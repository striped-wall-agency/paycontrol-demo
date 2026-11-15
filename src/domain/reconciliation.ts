import type { ProviderRow, Result, Transaction } from "./types";
const statuses = {
  Succeeded: "Settled",
  Failed: "Declined",
  Pending: "Pending",
};
export function reconcile(
  batchId: string,
  transactions: Transaction[],
  providers: ProviderRow[],
): Result[] {
  const internal = transactions.filter((t) => t.batchId === batchId),
    external = providers.filter((p) => p.batchId === batchId);
  const keys = [
    ...new Set([
      ...internal.map((t) => t.id),
      ...external.map((p) => p.canonicalId),
    ]),
  ].sort();
  return keys.map((key) => {
    const left = internal.filter((t) => t.id === key),
      right = external.filter((p) => p.canonicalId === key),
      categories: string[] = [];
    if (!left.length) categories.push("Missing internal record");
    if (!right.length) categories.push("Missing provider record");
    if (left.length > 1 || right.length > 1)
      categories.push("Duplicate record");
    if (left.length === 1 && right.length === 1) {
      if (left[0].amount !== right[0].amount)
        categories.push("Amount mismatch");
      if (left[0].currency !== right[0].currency)
        categories.push("Currency mismatch");
      if (statuses[left[0].status] !== right[0].status)
        categories.push("Status mismatch");
      if (
        Math.abs(Date.parse(left[0].createdAt) - Date.parse(right[0].eventAt)) >
        86400000
      )
        categories.push("Timing difference");
    }
    return {
      id: `${batchId}:${key}`,
      batchId,
      canonicalId: key,
      accountingDate: left[0]?.accountingDate ?? right[0].accountingDate,
      internal: left,
      provider: right,
      categories,
      reviewState: "Open",
      comments: [],
      fingerprint: JSON.stringify({ left, right }),
    };
  });
}
export function mergeResults(existing: Result[], fresh: Result[]): Result[] {
  const merged = new Map(existing.map((r) => [r.id, r]));
  for (const result of fresh) {
    const old = merged.get(result.id);
    if (old && old.fingerprint !== result.fingerprint)
      throw new Error("Source comparison changed. Reload before reviewing.");
    merged.set(
      result.id,
      old
        ? { ...result, reviewState: old.reviewState, comments: old.comments }
        : result,
    );
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}
