import { useState } from "react";
import {
  Badge,
  DecisionForm,
  Empty,
  History,
  PageHeader,
  Select,
  Table,
} from "../components";
import { useApp } from "../context";
import { money } from "../domain/selectors";
export function Issues() {
  const { data } = useApp(),
    [queue, setQueue] = useState("All"),
    [state, setState] = useState("All");
  const rows = data.issues.filter(
    (i) =>
      (queue === "All" || i.queue === queue) &&
      (state === "All" || i.state === state),
  );
  return (
    <>
      <PageHeader
        eyebrow="Operations / Payment issues"
        title="Payment issues"
        description="A clear queue for payments that need a closer look."
      />
      <div className="callout">
        Age uses demo reference time: November 14, 2026, 23:59 UTC.
        Investigation state is independent of financial status.
      </div>
      <section className="card">
        <div className="toolbar">
          <Select
            label="Payment queue"
            value={queue}
            onChange={setQueue}
            options={["All", "Failed", "Pending", "Needs Review"]}
          />
          <Select
            label="Investigation state"
            value={state}
            onChange={setState}
            options={["All", "Open", "Resolved", "Escalated", "Monitoring"]}
          />
        </div>
        {rows.length ? (
          <Table
            caption="Payment investigations"
            headers={[
              "Issue / payment",
              "Queue",
              "Reason",
              "Priority",
              "Age",
              "Investigation",
            ]}
          >
            {rows.map((i) => {
              const t = data.transactions.find(
                (t) => t.id === i.transactionId,
              )!;
              return (
                <tr key={i.id}>
                  <td>
                    <a href={`/issues/${i.id}`}>{i.id} ↗</a>
                    <small>
                      <a href={`/transactions/${t.id}`}>{t.id}</a>
                    </small>
                  </td>
                  <td>
                    <Badge>{i.queue}</Badge>
                  </td>
                  <td>{i.reason}</td>
                  <td>{i.priority}</td>
                  <td>
                    {Math.floor(
                      (Date.parse("2026-11-14T23:59:00Z") -
                        Date.parse(t.createdAt)) /
                        86400000,
                    )}{" "}
                    days
                  </td>
                  <td>
                    <Badge>{i.state}</Badge>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty>No issues match these filters.</Empty>
        )}
      </section>
    </>
  );
}
export function IssueDetails({ id }: { id: string }) {
  const { data, mutate, busy } = useApp(),
    issue = data.issues.find((i) => i.id === id);
  if (!issue)
    return (
      <Empty>
        Issue not found. <a href="/issues">Back to issues</a>
      </Empty>
    );
  const t = data.transactions.find((t) => t.id === issue.transactionId)!,
    retries = data.transactions.filter(
      (row) => row.chainId === t.chainId && row.id !== t.id,
    );
  return (
    <>
      <a className="back" href="/issues">
        ← Payment issues
      </a>
      <PageHeader
        eyebrow="Operations / Investigation"
        title={issue.id}
        description={issue.reason}
        action={<Badge>{issue.state}</Badge>}
      />
      <div className="two-columns">
        <section className="card">
          <h2>Original payment</h2>
          <a href={`/transactions/${t.id}`}>{t.id} ↗</a>
          <p className="large-number">{money(t.amount, t.currency)}</p>
          <dl>
            <dt>Financial status</dt>
            <dd>
              <Badge>{t.status}</Badge>
            </dd>
            <dt>Queue</dt>
            <dd>{issue.queue}</dd>
            <dt>Priority</dt>
            <dd>{issue.priority}</dd>
            <dt>Customer</dt>
            <dd>{t.customer}</dd>
          </dl>
          <h3>Subsequent attempts</h3>
          {retries.length ? (
            retries.map((r) => (
              <p key={r.id}>
                <a href={`/transactions/${r.id}`}>{r.id}</a>{" "}
                <Badge>{r.status}</Badge>
              </p>
            ))
          ) : (
            <p className="muted">No subsequent retry.</p>
          )}
        </section>
        <DecisionForm
          busy={busy}
          options={["Resolved", "Escalated", "Monitoring"]}
          onSave={(state, comment) =>
            mutate(
              {
                type: "issue",
                id,
                state: state as "Resolved" | "Escalated" | "Monitoring",
                comment,
              },
              "Investigation saved",
            )
          }
        />
      </div>
      <History comments={issue.comments} />
    </>
  );
}
