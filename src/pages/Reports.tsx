import { useState } from "react";
import { PageHeader, Period, Table } from "../components";
import { useApp } from "../context";
import { csv, metrics, money, validateRange } from "../domain/selectors";
import { batches } from "../domain/types";
import { download } from "../export";
import { DailyChart } from "./Overview";
export function Reports() {
  const { data, user, mutate, busy } = useApp(),
    [period, setPeriod] = useState(user.settings);
  let error = "";
  try {
    validateRange(period.start, period.end);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const m = metrics(data, error ? user.settings : period);
  const summaries = batches.map((b) => {
    const rows = m.results.filter((r) => r.batchId === b.id);
    return {
      batch: b.id,
      run: data.runs.some((r) => r.batchId === b.id),
      total: rows.length,
      matched: rows.filter((r) => !r.categories.length).length,
      needsReview: rows.filter((r) => r.categories.length).length,
      open: rows.filter(
        (r) => r.categories.length && r.reviewState !== "Resolved",
      ).length,
    };
  });
  async function exportSummary() {
    if (
      await mutate(
        { type: "export", entity: "Payment and reconciliation summary" },
        "Summary exported",
      )
    )
      download(
        "paycontrol-summary.csv",
        csv([
          [
            "Period start UTC",
            "Period end UTC",
            "Currency",
            "Attempts",
            "Success rate",
          ],
          [
            period.start,
            period.end,
            period.currency,
            m.attempts,
            m.rate === null ? "" : (m.rate * 100).toFixed(2),
          ],
          [],
          ["Gross successful currency", "Minor units"],
          ...m.volumes
            .filter(
              (v) =>
                period.currency === "All" || v.currency === period.currency,
            )
            .map((v) => [v.currency, v.amount]),
          [],
          ["Succeeded refund count", "Currency", "Refund minor units"],
          ...m.refundVolumes
            .filter(
              (v) =>
                period.currency === "All" || v.currency === period.currency,
            )
            .map((v) => [
              m.refunds.filter((r) => r.currency === v.currency).length,
              v.currency,
              v.amount,
            ]),
          [],
          [
            "Batch",
            "Run",
            "Results in accounting period",
            "Matched",
            "Needs Review",
            "Open",
          ],
          ...summaries.map((s) => [
            s.batch,
            s.run ? "Yes" : "Not run",
            s.run ? s.total : "Not run",
            s.run ? s.matched : "Not run",
            s.run ? s.needsReview : "Not run",
            s.run ? s.open : "Not run",
          ]),
        ]),
      );
  }
  return (
    <>
      <PageHeader
        eyebrow="Monitor / Reports"
        title="Reports"
        description="The same source of truth, ready for a wider view."
        action={
          <button disabled={busy || !!error} onClick={exportSummary}>
            ↓ Export summary CSV
          </button>
        }
      />
      <section className="card">
        <Period value={period} onChange={setPeriod} />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      {!error && (
        <>
          <section className="card">
            <h2>Payment performance</h2>
            <p>
              {m.attempts} attempts ·{" "}
              {m.rate === null ? "—" : `${(m.rate * 100).toFixed(1)}%`} success
              rate
            </p>
            <p>
              {m.volumes
                .filter(
                  (v) =>
                    period.currency === "All" || v.currency === period.currency,
                )
                .map((v) => `${money(v.amount, v.currency)} ${v.currency}`)
                .join(" · ")}{" "}
              gross successful volume
            </p>
            <DailyChart data={data} period={period} />
          </section>
          <section className="card">
            <h2>Reconciliation outcomes</h2>
            <p className="muted">
              Rows selected by accounting date and either source currency.
              Review decisions do not change comparison outcomes.
            </p>
            <Table
              caption="Batch reconciliation summary"
              headers={[
                "Batch",
                "Results",
                "Matched",
                "Needs Review",
                "Open discrepancies",
              ]}
            >
              {summaries.map((s) => (
                <tr key={s.batch}>
                  <td>
                    <a href="/reconciliation">{s.batch}</a>
                  </td>
                  {[s.total, s.matched, s.needsReview, s.open].map((v, i) => (
                    <td key={i}>{s.run ? v : "Not run"}</td>
                  ))}
                </tr>
              ))}
            </Table>
          </section>
          <p>
            <a
              href={`/transactions?${new URLSearchParams({ start: period.start, end: period.end, currency: period.currency })}`}
            >
              Export transactions for this period →
            </a>
          </p>
        </>
      )}
    </>
  );
}
