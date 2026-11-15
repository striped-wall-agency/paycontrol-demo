import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import { mergeResults, reconcile } from "./reconciliation";
import { applyCommand } from "./mutations";
import { csv, filterTransactions, inPeriod, metrics } from "./selectors";
import { defaultFilters, defaultSettings } from "./types";
describe("reconciliation invariants", () => {
  it("covers every mismatch, missing side and duplicate without creating internal payments", () => {
    const s = createSeed(),
      results = ["BATCH-01", "BATCH-02"].flatMap((b) =>
        reconcile(b, s.transactions, s.providerRows),
      );
    expect(new Set(results.flatMap((r) => r.categories))).toEqual(
      new Set([
        "Amount mismatch",
        "Currency mismatch",
        "Status mismatch",
        "Timing difference",
        "Duplicate record",
        "Missing internal record",
        "Missing provider record",
      ]),
    );
    expect(
      results.find((r) => r.canonicalId === "TX-EXTERNAL")?.internal,
    ).toHaveLength(0);
    expect(
      results.find((r) => r.categories.includes("Duplicate record"))?.provider,
    ).toHaveLength(2);
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length);
    expect(results).toEqual(
      ["BATCH-01", "BATCH-02"].flatMap((b) =>
        reconcile(b, s.transactions, s.providerRows),
      ),
    );
  });
  it("accepts 24h exactly, rejects a millisecond over, and never compares ambiguous pairs", () => {
    const s = createSeed(),
      t = s.transactions[0],
      p = {
        ...s.providerRows[0],
        eventAt: new Date(Date.parse(t.createdAt) + 86400000).toISOString(),
      };
    expect(reconcile(t.batchId, [t], [p])[0].categories).toEqual([]);
    expect(
      reconcile(
        t.batchId,
        [t],
        [
          {
            ...p,
            eventAt: new Date(Date.parse(t.createdAt) + 86400001).toISOString(),
          },
        ],
      )[0].categories,
    ).toEqual(["Timing difference"]);
    expect(
      reconcile(t.batchId, [t, t], [{ ...p, amount: 0 }])[0].categories,
    ).toEqual(["Duplicate record"]);
  });
  it("preserves review history on rerun and refuses changed fingerprints", () => {
    const s = createSeed(),
      fresh = reconcile("BATCH-01", s.transactions, s.providerRows),
      reviewed = {
        ...fresh[0],
        reviewState: "Resolved" as const,
        comments: [
          {
            at: "2026-11-15T00:00:00Z",
            author: "Alex",
            text: "Investigated",
            state: "Resolved",
          },
        ],
      };
    expect(
      mergeResults([reviewed], fresh).find((r) => r.id === reviewed.id),
    ).toEqual(reviewed);
    expect(() =>
      mergeResults([{ ...reviewed, fingerprint: "changed" }], fresh),
    ).toThrow("Source comparison changed");
  });
});
describe("selectors and CSV", () => {
  it("uses inclusive UTC days and createdAt for refunds, never nets gross payments", () => {
    expect(
      inPeriod("2026-11-14T23:59:59.999Z", "2026-11-14", "2026-11-14"),
    ).toBe(true);
    expect(
      inPeriod("2026-11-15T00:00:00.000Z", "2026-11-14", "2026-11-14"),
    ).toBe(false);
    const s = createSeed(),
      m = metrics(s, {
        ...defaultSettings,
        start: "2026-11-05",
        end: "2026-11-05",
      });
    expect(m.refunds[0].transactionId).toBe("TX-1001");
    expect(m.volumes.find((v) => v.currency === "USD")?.amount).toBe(
      m.tx
        .filter((t) => t.currency === "USD" && t.status === "Succeeded")
        .reduce((sum, t) => sum + t.amount, 0),
    );
    expect(
      metrics(s, { ...defaultSettings, start: "2027-01-01", end: "2027-01-01" })
        .rate,
    ).toBeNull();
  });
  it("combines search and amount/date/currency filters and validates ranges", () => {
    const s = createSeed(),
      t = s.transactions[1];
    for (const search of [
      t.id,
      t.providerRef,
      t.orderId,
      t.customer.toUpperCase(),
      t.email,
    ])
      expect(
        filterTransactions(s.transactions, { ...defaultFilters, search }),
      ).toContainEqual(t);
    expect(
      filterTransactions(s.transactions, {
        ...defaultFilters,
        search: t.id,
        currency: "EUR",
      }),
    ).toHaveLength(0);
    expect(() =>
      filterTransactions(s.transactions, {
        ...defaultFilters,
        min: "20",
        max: "10",
      }),
    ).toThrow("minimum");
    expect(() =>
      filterTransactions(s.transactions, {
        ...defaultFilters,
        start: "2026-11-20",
      }),
    ).toThrow("date");
  });
  it("quotes Unicode, newlines and quotes, neutralizing spreadsheet formulas", () => {
    const output = csv([["=HYPERLINK(1)", 'a,"b"\nc', " Привет", " @SUM(1)"]]);
    expect(output).toBe(
      '\uFEFF"\'=HYPERLINK(1)","a,""b""\nc"," Привет","\' @SUM(1)"',
    );
  });
});
describe("mutation guards and audit", () => {
  it("enforces role on mutation API and requires comments", () => {
    let s = applyCommand(createSeed(), {
      type: "login",
      userId: "user-operator",
    });
    expect(() => applyCommand(s, { type: "workspace", name: "Other" })).toThrow(
      "Admin",
    );
    expect(() =>
      applyCommand(s, {
        type: "user",
        name: "New",
        email: "a@b.com",
        role: "Admin",
        active: true,
      }),
    ).toThrow("Admin");
    expect(() =>
      applyCommand(s, {
        type: "issue",
        id: s.issues[0].id,
        state: "Resolved",
        comment: "  ",
      }),
    ).toThrow("comment");
    const original = s.transactions[2].status;
    s = applyCommand(s, {
      type: "issue",
      id: s.issues[0].id,
      state: "Resolved",
      comment: "Subsequent retry succeeded",
    });
    expect(s.transactions[2].status).toBe(original);
    expect(s.audit[0]).toMatchObject({
      before: "Open",
      after: "Resolved",
      role: "Operator",
      comment: "Subsequent retry succeeded",
    });
  });
  it("protects self-disable, last admin, unique email, and inactive login", () => {
    let s = applyCommand(createSeed(), { type: "login", userId: "user-admin" });
    const admin = {
      type: "user" as const,
      id: "user-admin",
      name: "Jordan",
      email: "jordan@northstar.example",
      role: "Admin" as const,
      active: false,
    };
    expect(() => applyCommand(s, admin)).toThrow("yourself");
    expect(() =>
      applyCommand(s, { ...admin, active: true, role: "Operator" }),
    ).toThrow("at least one");
    expect(() =>
      applyCommand(s, {
        type: "user",
        name: "Duplicate",
        email: "ALEX@northstar.example",
        role: "Operator",
        active: true,
      }),
    ).toThrow("unique");
    s = applyCommand(s, {
      type: "user",
      id: "user-operator",
      name: "Alex",
      email: "alex@northstar.example",
      role: "Operator",
      active: false,
    });
    expect(() =>
      applyCommand(s, { type: "login", userId: "user-operator" }),
    ).toThrow("active");
  });
  it("reruns keep decisions with a separate run and audit", () => {
    let s = applyCommand(createSeed(), {
      type: "login",
      userId: "user-operator",
    });
    s = applyCommand(s, { type: "run", batchId: "BATCH-01" });
    const r = s.results.find((r) => r.categories.length)!;
    s = applyCommand(s, {
      type: "review",
      id: r.id,
      state: "Reviewed",
      comment: "Provider contacted",
    });
    const open = metrics(s, defaultSettings).open;
    s = applyCommand(s, { type: "run", batchId: "BATCH-01" });
    expect(s.results.find((x) => x.id === r.id)?.comments).toHaveLength(1);
    expect(s.runs).toHaveLength(2);
    expect(metrics(s, defaultSettings).open).toBe(open);
    s = applyCommand(s, {
      type: "review",
      id: r.id,
      state: "Resolved",
      comment: "Closed investigation",
    });
    expect(metrics(s, defaultSettings).open).toBe(open - 1);
    expect(
      s.results.find((x) => x.id === r.id)?.categories.length,
    ).toBeGreaterThan(0);
  });
});
