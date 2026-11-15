import { useState } from "react";
import { useApp } from "../context";
import {
  Badge,
  DecisionForm,
  Empty,
  History,
  PageHeader,
  Period,
  Select,
  Table,
} from "../components";
import {
  batches,
  type Result,
  type ReviewState,
  type Settings,
} from "../domain/types";
import { money, utc, validateRange } from "../domain/selectors";
export function Reconciliation() {
  const { data, user, mutate, busy } = useApp(),
    params = new URLSearchParams(location.search);
  const [batch, setBatch] = useState("BATCH-01"),
    [matching, setMatching] = useState(params.get("matching") ?? "All"),
    [category, setCategory] = useState("All"),
    [review, setReview] = useState(params.get("review") ?? "All");
  const [period, setPeriod] = useState<Settings>({
    ...user.settings,
    ...Object.fromEntries(
      ["start", "end", "currency"]
        .filter((k) => params.has(k))
        .map((k) => [k, params.get(k)]),
    ),
  });
  const [allBatches, setAllBatches] = useState(params.has("matching"));
  const run = data.runs.filter((r) => r.batchId === batch).at(-1),
    categories = [...new Set(data.results.flatMap((r) => r.categories))].sort();
  let error = "";
  try {
    validateRange(period.start, period.end);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const base = error
    ? []
    : data.results.filter(
        (r) =>
          (allBatches || r.batchId === batch) &&
          r.accountingDate >= period.start &&
          r.accountingDate <= period.end &&
          (period.currency === "All" ||
            [...r.internal, ...r.provider].some(
              (v) => v.currency === period.currency,
            )),
      );
  const rows = base.filter(
    (r) =>
      (matching === "All" ||
        (matching === "Matched"
          ? !r.categories.length
          : !!r.categories.length)) &&
      (category === "All" || r.categories.includes(category)) &&
      (review === "All" ||
        (review === "Unresolved"
          ? r.reviewState !== "Resolved"
          : r.reviewState === review)),
  );
  return (
    <>
      <PageHeader
        eyebrow="Operations / Reconciliation"
        title="Reconciliation"
        description="Bring your payment records and Meridian Pay into agreement."
        action={
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              mutate({ type: "run", batchId: batch }, "Reconciliation complete")
            }
          >
            {busy ? "Running…" : "↻ Run reconciliation"}
          </button>
        }
      />
      <section className="card">
        <div className="toolbar">
          <label className="field">
            <span>Accounting batch · UTC inclusive</span>
            <select
              value={batch}
              onChange={(e) => {
                setBatch(e.target.value);
                setAllBatches(false);
              }}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={allBatches}
              onChange={(e) => setAllBatches(e.target.checked)}
            />{" "}
            Show all batches
          </label>
        </div>
        <p className="muted">
          Exact canonical transaction ID · exact minor units & currency ·
          explicit status mapping · up to 24 hours inclusive.
        </p>
        <details>
          <summary>Matching rules & sources</summary>
          <p>
            Internal Succeeded ↔ Settled, Failed ↔ Declined, Pending ↔ Pending.
            Missing records and duplicate keys always need review. Duplicate
            groups are shown in full; ambiguous groups are never compared or
            counted twice. Timing uses absolute event delta, not accounting
            period. Stable IDs preserve reviews on rerun.
          </p>
        </details>
        {run ? (
          <p>
            Last run: {utc(run.at)} · {run.author} · {run.matched} matched /{" "}
            {run.needsReview} need review
          </p>
        ) : (
          <p className="muted">
            This batch has not been run. Run reconciliation to compare the fixed
            seed inputs.
          </p>
        )}
      </section>
      {!data.runs.length ? (
        <section className="card">
          <Empty>Choose a batch and run your first reconciliation.</Empty>
        </section>
      ) : (
        <>
          <div className="stats compact">
            <div>
              <span>Results in period</span>
              <strong>{base.length}</strong>
            </div>
            <div>
              <span>Matched</span>
              <strong>{base.filter((r) => !r.categories.length).length}</strong>
            </div>
            <div>
              <span>Needs review</span>
              <strong>{base.filter((r) => r.categories.length).length}</strong>
            </div>
            <div>
              <span>Open discrepancies</span>
              <strong>
                {
                  base.filter(
                    (r) => r.categories.length && r.reviewState !== "Resolved",
                  ).length
                }
              </strong>
            </div>
          </div>
          <section className="card">
            <Period value={period} onChange={setPeriod} />
            <p className="muted">
              Period filters accounting dates of individual rows, not run
              timestamps. Currency matches either source side.
            </p>
            <div className="toolbar">
              <Select
                label="Comparison"
                value={matching}
                onChange={setMatching}
                options={["All", "Matched", "Needs Review"]}
              />
              <Select
                label="Category"
                value={category}
                onChange={setCategory}
                options={["All", ...categories]}
              />
              <Select
                label="Review status"
                value={review}
                onChange={setReview}
                options={["All", "Open", "Reviewed", "Resolved", "Unresolved"]}
              />
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {rows.length ? (
              <Table
                caption={`${rows.length} reconciliation results`}
                headers={[
                  "Canonical ID",
                  "Batch / accounting date",
                  "Comparison",
                  "Categories",
                  "Review status",
                ]}
              >
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a href={`/discrepancies/${encodeURIComponent(r.id)}`}>
                        {r.canonicalId} ↗
                      </a>
                    </td>
                    <td>
                      {r.batchId}
                      <small>{r.accountingDate}</small>
                    </td>
                    <td>
                      <Badge>
                        {r.categories.length ? "Needs Review" : "Matched"}
                      </Badge>
                    </td>
                    <td>{r.categories.join(" · ") || "All fields agree"}</td>
                    <td>
                      <Badge>{r.reviewState}</Badge>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>No results match these filters.</Empty>
            )}
          </section>
        </>
      )}
    </>
  );
}
function Comparison({ result }: { result: Result }) {
  const left = result.internal,
    right = result.provider,
    unique = left.length === 1 && right.length === 1;
  const delta = unique
    ? Math.abs(Date.parse(left[0].createdAt) - Date.parse(right[0].eventAt)) /
      3600000
    : null;
  return (
    <>
      <div className="comparison">
        <section className="card">
          <p className="eyebrow">Source 01</p>
          <h2>
            Internal records <span className="muted">({left.length})</span>
          </h2>
          {left.length ? (
            left.map((t, i) => (
              <dl key={`${t.id}-${i}`}>
                <dt>Canonical ID</dt>
                <dd>
                  <a href={`/transactions/${t.id}`}>{t.id} ↗</a>
                </dd>
                <dt>Provider reference</dt>
                <dd>{t.providerRef}</dd>
                <dt>Amount</dt>
                <dd
                  className={
                    result.categories.includes("Amount mismatch")
                      ? "difference"
                      : ""
                  }
                >
                  {money(t.amount, t.currency)} · {t.amount} minor units
                </dd>
                <dt>Currency</dt>
                <dd
                  className={
                    result.categories.includes("Currency mismatch")
                      ? "difference"
                      : ""
                  }
                >
                  {t.currency}
                </dd>
                <dt>Status</dt>
                <dd
                  className={
                    result.categories.includes("Status mismatch")
                      ? "difference"
                      : ""
                  }
                >
                  {t.status}
                </dd>
                <dt>Event time</dt>
                <dd
                  className={
                    result.categories.includes("Timing difference")
                      ? "difference"
                      : ""
                  }
                >
                  {utc(t.createdAt)}
                </dd>
                <dt>Accounting date</dt>
                <dd>{t.accountingDate}</dd>
              </dl>
            ))
          ) : (
            <p className="difference">Missing internal record</p>
          )}
        </section>
        <section className="card">
          <p className="eyebrow">Source 02</p>
          <h2>
            Meridian Pay <span className="muted">({right.length})</span>
          </h2>
          {right.length ? (
            right.map((p, i) => (
              <dl key={`${p.id}-${i}`}>
                <dt>Canonical ID</dt>
                <dd>{p.canonicalId}</dd>
                <dt>Provider reference</dt>
                <dd>{p.id}</dd>
                <dt>Amount</dt>
                <dd
                  className={
                    result.categories.includes("Amount mismatch")
                      ? "difference"
                      : ""
                  }
                >
                  {money(p.amount, p.currency)} · {p.amount} minor units
                </dd>
                <dt>Currency</dt>
                <dd
                  className={
                    result.categories.includes("Currency mismatch")
                      ? "difference"
                      : ""
                  }
                >
                  {p.currency}
                </dd>
                <dt>Status</dt>
                <dd
                  className={
                    result.categories.includes("Status mismatch")
                      ? "difference"
                      : ""
                  }
                >
                  {p.status}
                </dd>
                <dt>Event time</dt>
                <dd
                  className={
                    result.categories.includes("Timing difference")
                      ? "difference"
                      : ""
                  }
                >
                  {utc(p.eventAt)}
                </dd>
                <dt>Accounting date</dt>
                <dd>{p.accountingDate}</dd>
              </dl>
            ))
          ) : (
            <p className="difference">Missing provider record</p>
          )}
        </section>
      </div>
      <p className="callout">
        {unique
          ? `Absolute event-time difference: ${delta?.toFixed(2)} hours. Tolerance: ≤24 hours inclusive.`
          : "No field comparison for missing or ambiguous pairs. All source rows are displayed."}
      </p>
    </>
  );
}
export function DiscrepancyDetails({ id }: { id: string }) {
  const { data, mutate, busy } = useApp(),
    result = data.results.find((r) => r.id === id);
  if (!result)
    return (
      <Empty>
        Comparison not found.{" "}
        <a href="/reconciliation">Back to reconciliation</a>
      </Empty>
    );
  return (
    <>
      <a className="back" href="/reconciliation">
        ← Reconciliation
      </a>
      <PageHeader
        eyebrow="Operations / Comparison details"
        title={result.canonicalId}
        description={`${result.batchId} · Accounting date ${result.accountingDate}`}
        action={
          <Badge>{result.categories.length ? "Needs Review" : "Matched"}</Badge>
        }
      />
      <div className="callout">
        {result.categories.length
          ? result.categories.join(" · ")
          : "Exact comparison passed. All fields agree."}{" "}
        <strong>Review: {result.reviewState}</strong>
      </div>
      <Comparison result={result} />
      <div className="two-columns">
        <DecisionForm
          busy={busy}
          options={["Reviewed", "Resolved", "Open"]}
          onSave={(state, comment) =>
            mutate(
              { type: "review", id, state: state as ReviewState, comment },
              "Review saved",
            )
          }
        />
        <History comments={result.comments} />
      </div>
    </>
  );
}
