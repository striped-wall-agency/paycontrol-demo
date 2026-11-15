import { useState } from "react";
import { useApp } from "../context";
import { Badge, PageHeader, Period, Table } from "../components";
import { metrics, money, utc, validateRange } from "../domain/selectors";
import type { Settings, Snapshot } from "../domain/types";
export function DailyChart({
  data,
  period,
}: {
  data: Snapshot;
  period: Settings;
}) {
  const days = [
    ...new Set(
      data.transactions
        .filter(
          (t) =>
            t.createdAt.slice(0, 10) >= period.start &&
            t.createdAt.slice(0, 10) <= period.end &&
            (period.currency === "All" || t.currency === period.currency),
        )
        .map((t) => t.createdAt.slice(0, 10)),
    ),
  ].sort();
  const values = days.map((day) => {
      const m = metrics(data, { ...period, start: day, end: day });
      return {
        day,
        attempts: m.attempts,
        succeeded: m.tx.filter((t) => t.status === "Succeeded").length,
        volumes: m.volumes,
      };
    }),
    max = Math.max(...values.map((v) => v.attempts), 1);
  return (
    <>
      <div className="chart" aria-hidden="true">
        {values.map((v) => (
          <div className="chart-column" key={v.day}>
            <div
              className="bar-total"
              style={{ height: `${(v.attempts / max) * 130}px` }}
            >
              <div
                className="bar-success"
                style={{ height: `${(v.succeeded / v.attempts) * 100}%` }}
              />
            </div>
            <span>{v.day.slice(-2)}</span>
          </div>
        ))}
      </div>
      <p className="legend">
        <i /> Successful <i className="pale" /> All attempts · November 2026 UTC
      </p>
      <details>
        <summary>View daily figures</summary>
        <Table
          caption="Daily payment performance"
          headers={[
            "Date UTC",
            "Attempts",
            "Succeeded",
            "Gross successful USD",
            "Gross successful EUR",
          ]}
        >
          {values.map((v) => (
            <tr key={v.day}>
              <td>{v.day}</td>
              <td>{v.attempts}</td>
              <td>{v.succeeded}</td>
              {v.volumes.map((x) => (
                <td key={x.currency}>{money(x.amount, x.currency)}</td>
              ))}
            </tr>
          ))}
        </Table>
        {!values.length && <p>No payment attempts in this period.</p>}
      </details>
    </>
  );
}
export function Overview() {
  const { data, user, mutate, busy } = useApp(),
    [period, setPeriod] = useState(user.settings);
  let error = "";
  try {
    validateRange(period.start, period.end);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const m = metrics(data, error ? user.settings : period),
    query = new URLSearchParams({
      start: period.start,
      end: period.end,
      currency: period.currency,
    }).toString();
  const txLink = (status?: string) =>
    `/transactions?${query}${status ? `&status=${status}` : ""}`;
  return (
    <>
      <PageHeader
        eyebrow="Monitor / Overview"
        title="Your payments, in focus."
        description="A connected view of performance, exceptions and the work ahead."
        action={
          <a className="button primary" href="/reconciliation">
            Open reconciliation →
          </a>
        }
      />
      <section className="period-row">
        <Period value={period} onChange={setPeriod} />
        <button
          disabled={busy || !!error}
          onClick={() =>
            mutate(
              { type: "settings", name: user.name, settings: period },
              "Default period saved",
            )
          }
        >
          Save default view
        </button>
      </section>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : (
        <>
          <div className="stats">
            <a href={txLink()}>
              <span>Payment attempts ↗</span>
              <strong>{m.attempts}</strong>
              <small>All internal attempts</small>
            </a>
            <a href={txLink("Succeeded")}>
              <span>Gross successful volume ↗</span>
              <strong className="money-stack">
                {m.volumes
                  .filter(
                    (v) =>
                      period.currency === "All" ||
                      v.currency === period.currency,
                  )
                  .map((v) => (
                    <span key={v.currency}>
                      {money(v.amount, v.currency)} <small>{v.currency}</small>
                    </span>
                  ))}
              </strong>
              <small>Before refunds · no FX conversion</small>
            </a>
            <a href={txLink("Succeeded")}>
              <span>Payment success rate ↗</span>
              <strong>
                {m.rate === null ? "—" : `${(m.rate * 100).toFixed(1)}%`}
              </strong>
              <small>Succeeded / all attempts</small>
            </a>
            <a href={`/refunds?${query}&status=Succeeded`}>
              <span>Succeeded refunds ↗</span>
              <strong>{m.refunds.length}</strong>
              <small>
                {m.refundVolumes
                  .filter(
                    (v) =>
                      period.currency === "All" ||
                      v.currency === period.currency,
                  )
                  .map((v) => `${money(v.amount, v.currency)} ${v.currency}`)
                  .join(" · ")}
              </small>
            </a>
            <a
              href={`/reconciliation?${query}&matching=Needs+Review&review=Unresolved`}
            >
              <span>Open discrepancies ↗</span>
              <strong>{data.runs.length ? m.open : "Not run"}</strong>
              <small>By accounting date · Reviewed stays open</small>
            </a>
          </div>
          <div className="dashboard-grid">
            <section className="card">
              <div className="section-heading">
                <h2>Payment activity</h2>
                <span className="muted">Attempts by day</span>
              </div>
              <DailyChart data={data} period={period} />
            </section>
            <section className="card attention">
              <p className="eyebrow">Your next actions</p>
              <h2>Needs your attention</h2>
              <div className="attention-number">
                {data.issues.filter((i) => i.state !== "Resolved").length}
                <span>active investigations</span>
              </div>
              <p className="muted">
                Follow up on declines and delayed confirmations.
              </p>
              <a className="button" href="/issues">
                Review payment issues →
              </a>
              <a className="queue-link" href="/reconciliation">
                {data.runs.length
                  ? `${m.open} open discrepancies in period`
                  : "Reconciliation is ready to run"}{" "}
                →
              </a>
            </section>
          </div>
          <section className="card flush">
            <div className="section-heading">
              <h2>Recent activity</h2>
              <a href="/activity">View activity log →</a>
            </div>
            {data.audit.length ? (
              <Table
                caption="Latest workspace actions"
                headers={["Action", "Entity", "Employee", "Time · UTC"]}
              >
                {data.audit.slice(0, 5).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Badge>{a.action}</Badge>
                    </td>
                    <td>
                      <a href={a.link}>{a.entity}</a>
                    </td>
                    <td>
                      {a.actor}
                      <small>{a.role}</small>
                    </td>
                    <td>{utc(a.at)}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p>No activity yet.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
