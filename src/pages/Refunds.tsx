import { useState } from "react";
import { useApp } from "../context";
import { Badge, Empty, PageHeader, Period, Select, Table } from "../components";
import { inPeriod, money, utc, validateRange } from "../domain/selectors";
export function Refunds() {
  const { data, user } = useApp(),
    params = new URLSearchParams(location.search),
    [period, setPeriod] = useState({
      ...user.settings,
      ...Object.fromEntries(
        ["start", "end", "currency"]
          .filter((k) => params.has(k))
          .map((k) => [k, params.get(k)]),
      ),
    }),
    [status, setStatus] = useState(params.get("status") ?? "All");
  let error = "";
  try {
    validateRange(period.start, period.end);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const rows = error
    ? []
    : data.refunds.filter(
        (r) =>
          inPeriod(r.createdAt, period.start, period.end) &&
          (period.currency === "All" || r.currency === period.currency) &&
          (status === "All" || r.status === status) &&
          (!params.get("transaction") ||
            params.get("transaction") === r.transactionId),
      );
  return (
    <>
      <PageHeader
        eyebrow="Operations / Refunds"
        title="Refunds"
        description="Follow the refund lifecycle without changing original payment totals."
      />
      <section className="card">
        <Period value={period} onChange={setPeriod} />
        <Select
          label="Refund status"
          value={status}
          onChange={setStatus}
          options={["All", "Requested", "Processing", "Succeeded", "Failed"]}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {rows.length ? (
          <Table
            caption={`${rows.length} refunds`}
            headers={[
              "Refund",
              "Original payment",
              "Status",
              "Amount",
              "Reason",
              "Created · UTC",
            ]}
          >
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>
                  <a href={`/transactions/${r.transactionId}`}>
                    {r.transactionId} ↗
                  </a>
                </td>
                <td>
                  <Badge>{r.status}</Badge>
                </td>
                <td>
                  {money(r.amount, r.currency)} {r.currency}
                </td>
                <td>{r.reason}</td>
                <td>{utc(r.createdAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No refunds match this selection.</Empty>
        )}
      </section>
      <p className="muted">
        Seed records only. This local demo does not issue real refunds.
      </p>
    </>
  );
}
