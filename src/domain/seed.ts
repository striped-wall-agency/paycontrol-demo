import {
  defaultSettings,
  type Snapshot,
  type Transaction,
  type ProviderRow,
} from "./types";
export function createSeed(): Snapshot {
  const names = [
    "Olivia Bennett",
    "Liam Chen",
    "Amelia Wilson",
    "Noah Davis",
    "Isabella Rossi",
    "Ethan Morgan",
    "Sophia Patel",
    "Lucas Martin",
  ];
  const transactions: Transaction[] = Array.from({ length: 42 }, (_, i) => {
    const day = Math.floor(i / 3) + 1,
      id = `TX-${1001 + i}`,
      date = `2026-11-${String(day).padStart(2, "0")}T${String(9 + (i % 9)).padStart(2, "0")}:15:00.000Z`;
    const status =
      i % 7 === 2 ? "Failed" : i % 9 === 4 ? "Pending" : "Succeeded";
    return {
      id,
      providerRef: `MP-${81001 + i}`,
      orderId: `ORD-${2001 + i}`,
      customer: names[i % 8],
      email: `${names[i % 8].toLowerCase().replace(" ", ".")}@example.com`,
      amount: 2500 + ((i * 1777) % 48000),
      currency: i % 4 === 0 ? "EUR" : "USD",
      status,
      source: (["Checkout", "Subscription", "Payment link"] as const)[i % 3],
      createdAt: date,
      updatedAt: date,
      accountingDate: date.slice(0, 10),
      batchId: day <= 7 ? "BATCH-01" : "BATCH-02",
      method: `Visa ···· ${4242 + (i % 5)}`,
      chainId: i === 3 ? "CHAIN-1003" : `CHAIN-${1001 + i}`,
      events: [
        { at: date, text: "Payment attempt created" },
        {
          at: date,
          text:
            status === "Succeeded"
              ? "Provider confirmed settlement"
              : status === "Failed"
                ? "Provider declined: insufficient funds"
                : "Awaiting provider confirmation",
        },
      ],
    };
  });
  transactions[3].orderId = transactions[2].orderId;
  transactions[3].events.push({
    at: transactions[3].createdAt,
    text: "Successful retry of TX-1003; original attempt remains Failed",
  });
  const providerRows: ProviderRow[] = transactions
    .filter((_, i) => i !== 5 && i !== 28)
    .map((t, i) => ({
      id: t.providerRef,
      canonicalId: t.id,
      amount: t.amount,
      currency: t.currency,
      status:
        t.status === "Succeeded"
          ? "Settled"
          : t.status === "Failed"
            ? "Declined"
            : "Pending",
      eventAt: t.createdAt,
      accountingDate: t.accountingDate,
      batchId: t.batchId,
      ...(i === 7 ? { amount: t.amount + 350 } : {}),
      ...(i === 11
        ? {
            currency:
              t.currency === "USD" ? ("EUR" as const) : ("USD" as const),
          }
        : {}),
      ...(i === 14 ? { status: "Pending" as const } : {}),
      ...(i === 17
        ? {
            eventAt: new Date(
              Date.parse(t.createdAt) + 25 * 3600000,
            ).toISOString(),
          }
        : {}),
      ...(i === 19
        ? {
            eventAt: new Date(
              Date.parse(t.createdAt) + 24 * 3600000,
            ).toISOString(),
          }
        : {}),
      ...(i === 30
        ? { amount: t.amount + 100, status: "Declined" as const }
        : {}),
    }));
  providerRows.push(
    { ...providerRows[9], id: "MP-DUPLICATE" },
    {
      id: "MP-EXTERNAL",
      canonicalId: "TX-EXTERNAL",
      amount: 12900,
      currency: "USD",
      status: "Settled",
      eventAt: "2026-11-09T10:00:00.000Z",
      accountingDate: "2026-11-09",
      batchId: "BATCH-02",
    },
  );
  return {
    schemaVersion: 1,
    revision: 0,
    transactions,
    providerRows,
    issues: transactions
      .filter((t) => t.status !== "Succeeded")
      .map((t, i) => ({
        id: `ISS-${101 + i}`,
        transactionId: t.id,
        queue:
          i === 2
            ? "Needs Review"
            : t.status === "Failed"
              ? "Failed"
              : "Pending",
        reason:
          t.status === "Failed"
            ? "Insufficient funds · issuer decline"
            : "Provider confirmation delayed",
        priority: i % 2 ? "Medium" : "High",
        state: "Open",
        comments: [],
      })),
    refunds: [0, 1, 6, 8, 10, 15, 22, 27].map((n, i) => ({
      id: `REF-${501 + i}`,
      transactionId: transactions[n].id,
      amount: Math.floor(transactions[n].amount / 2),
      currency: transactions[n].currency,
      status: (["Succeeded", "Requested", "Processing", "Failed"] as const)[
        i % 4
      ],
      createdAt: `2026-11-${String(5 + i).padStart(2, "0")}T14:00:00.000Z`,
      reason: i % 2 ? "Duplicate order" : "Customer request",
    })),
    results: [],
    runs: [],
    users: [
      {
        id: "user-operator",
        name: "Alex Morgan",
        email: "alex@northstar.example",
        role: "Operator",
        active: true,
        settings: { ...defaultSettings },
      },
      {
        id: "user-admin",
        name: "Jordan Lee",
        email: "jordan@northstar.example",
        role: "Admin",
        active: true,
        settings: { ...defaultSettings },
      },
    ],
    activeUserId: null,
    audit: [],
    workspaceName: "Northstar Commerce",
  };
}
