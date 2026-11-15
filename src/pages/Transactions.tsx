import { useState } from "react";
import { useApp } from "../context";
import {
  Badge,
  Empty,
  Field,
  PageHeader,
  Period,
  Select,
  Table,
} from "../components";
import {
  csv,
  filterTransactions,
  money,
  totals,
  utc,
} from "../domain/selectors";
import { defaultFilters, type TransactionFilters } from "../domain/types";
import { download } from "../export";
export function Transactions() {
  const { data, user, mutate, busy, navigate } = useApp();
  const params = new URLSearchParams(location.search);
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    ...defaultFilters,
    ...(params.size ? {} : user.settings.transactionFilters),
    ...Object.fromEntries(
      ["start", "end", "currency", "status"]
        .filter((k) => params.has(k))
        .map((k) => [k, params.get(k)]),
    ),
  }));
  let rows: typeof data.transactions = [],
    error = "";
  try {
    rows = filterTransactions(data.transactions, filters);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const change = (patch: Partial<TransactionFilters>) =>
    setFilters({ ...filters, ...patch, page: 1 });
  const pages = Math.max(1, Math.ceil(rows.length / 10)),
    page = Math.min(filters.page, pages);
  async function persist() {
    if (!error) await mutate({ type: "filters", filters }, "Filters saved");
  }
  async function openTransaction(id: string) {
    if (await mutate({ type: "filters", filters }, "Filters saved"))
      navigate(`/transactions/${id}`);
  }
  async function exportRows() {
    if (
      await mutate(
        { type: "export", entity: "Filtered transactions" },
        "CSV exported",
      )
    )
      download(
        "paycontrol-transactions.csv",
        csv([
          [
            "Transaction ID",
            "Provider reference",
            "Order",
            "Customer",
            "Email",
            "Amount",
            "Currency",
            "Status",
            "Source",
            "Created UTC",
          ],
          ...rows.map((t) => [
            t.id,
            t.providerRef,
            t.orderId,
            t.customer,
            t.email,
            (t.amount / 100).toFixed(2),
            t.currency,
            t.status,
            t.source,
            t.createdAt,
          ]),
        ]),
      );
  }
  return (
    <>
      <PageHeader
        eyebrow="Operations / Transactions"
        title="Transactions"
        description="Every payment attempt, with the context to move forward."
        action={
          <button disabled={busy || !!error} onClick={exportRows}>
            ↓ Export CSV
          </button>
        }
      />
      <section className="card">
        <Field label="Search transactions">
          <input
            type="search"
            placeholder="Search transaction, provider, order, customer or email…"
            value={filters.search}
            onChange={(e) => change({ search: e.target.value })}
          />
        </Field>
        <Period value={filters} onChange={(v) => change(v)} />
        <div className="toolbar">
          <Select
            label="Payment status"
            value={filters.status}
            onChange={(status) => change({ status })}
            options={["All", "Succeeded", "Failed", "Pending"]}
          />
          <Select
            label="Source"
            value={filters.source}
            onChange={(source) => change({ source })}
            options={["All", "Checkout", "Subscription", "Payment link"]}
          />
          <Field label="Minimum amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.min}
              onChange={(e) => change({ min: e.target.value })}
            />
          </Field>
          <Field label="Maximum amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.max}
              onChange={(e) => change({ max: e.target.value })}
            />
          </Field>
          <Select
            label="Sort by"
            value={filters.sort}
            onChange={(sort) =>
              change({ sort: sort as TransactionFilters["sort"] })
            }
            options={["date", "amount", "status"]}
          />
          <Select
            label="Direction"
            value={filters.direction}
            onChange={(direction) =>
              change({ direction: direction as "asc" | "desc" })
            }
            options={["desc", "asc"]}
          />
        </div>
        <div className="actions">
          <button onClick={() => setFilters({ ...defaultFilters })}>
            Reset filters
          </button>
          <button disabled={busy || !!error} onClick={persist}>
            Save filters
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      <section className="card flush">
        <div className="section-heading">
          <h2>{rows.length} transactions</h2>
          <span className="muted">
            {totals(rows)
              .map((v) => `${money(v.amount, v.currency)} ${v.currency}`)
              .join(" · ")}
          </span>
        </div>
        <p className="table-note">
          Mixed currencies sort by numeric face value; no currency conversion.
        </p>
        {rows.length ? (
          <>
            <Table
              caption="Payment attempts"
              headers={[
                "Transaction / order",
                "Customer",
                "Status",
                "Amount",
                "Source",
                "Created · UTC",
              ]}
            >
              {rows.slice((page - 1) * 10, page * 10).map((t) => (
                <tr key={t.id}>
                  <td>
                    <a
                      href={`/transactions/${t.id}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) return;
                        e.preventDefault();
                        e.stopPropagation();
                        void openTransaction(t.id);
                      }}
                    >
                      {t.id} ↗
                    </a>
                    <small>{t.orderId}</small>
                  </td>
                  <td>
                    {t.customer}
                    <small>{t.email}</small>
                  </td>
                  <td>
                    <Badge>{t.status}</Badge>
                  </td>
                  <td className="number">
                    {money(t.amount, t.currency)} <small>{t.currency}</small>
                  </td>
                  <td>{t.source}</td>
                  <td>{utc(t.createdAt)}</td>
                </tr>
              ))}
            </Table>
            <div className="pagination">
              <span>
                Page {page} of {pages}
              </span>
              <button
                disabled={page <= 1}
                onClick={() => setFilters({ ...filters, page: page - 1 })}
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setFilters({ ...filters, page: page + 1 })}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <Empty>Try another search or reset the filters.</Empty>
        )}
      </section>
    </>
  );
}
export function TransactionDetails({ id }: { id: string }) {
  const { data } = useApp(),
    t = data.transactions.find((t) => t.id === id);
  if (!t)
    return (
      <Empty>
        Transaction not found. <a href="/transactions">Back to transactions</a>
      </Empty>
    );
  const issue = data.issues.find((i) => i.transactionId === id),
    refunds = data.refunds.filter((r) => r.transactionId === id),
    chain = data.transactions.filter((row) => row.chainId === t.chainId);
  return (
    <>
      <a className="back" href="/transactions">
        ← Transactions
      </a>
      <PageHeader
        eyebrow="Operations / Transaction details"
        title={t.id}
        description={`${t.customer} · ${t.orderId}`}
        action={<Badge>{t.status}</Badge>}
      />
      <div className="two-columns">
        <section className="card">
          <h2>Payment details</h2>
          <strong className="large-number">
            {money(t.amount, t.currency)} {t.currency}
          </strong>
          <dl>
            <dt>Financial status</dt>
            <dd>
              <Badge>{t.status}</Badge>
            </dd>
            <dt>Created</dt>
            <dd>{utc(t.createdAt)}</dd>
            <dt>Updated</dt>
            <dd>{utc(t.updatedAt)}</dd>
            <dt>Source</dt>
            <dd>{t.source}</dd>
            <dt>Method</dt>
            <dd>{t.method}</dd>
            <dt>Provider</dt>
            <dd>Meridian Pay</dd>
            <dt>Provider reference</dt>
            <dd>{t.providerRef}</dd>
          </dl>
        </section>
        <section className="card">
          <h2>Customer & order</h2>
          <dl>
            <dt>Customer</dt>
            <dd>{t.customer}</dd>
            <dt>Email</dt>
            <dd>{t.email}</dd>
            <dt>Order</dt>
            <dd>{t.orderId}</dd>
            <dt>Retry chain</dt>
            <dd>{t.chainId}</dd>
          </dl>
          <h3>Related attempts</h3>
          {chain.map((row) => (
            <p key={row.id}>
              <a href={`/transactions/${row.id}`}>{row.id}</a>{" "}
              <Badge>{row.status}</Badge>
            </p>
          ))}
          {issue && (
            <p>
              <a href={`/issues/${issue.id}`}>Investigation {issue.id} →</a>
            </p>
          )}
          {refunds.map((r) => (
            <p key={r.id}>
              <a href={`/refunds?transaction=${id}`}>
                {r.id} · {money(r.amount, r.currency)} · {r.status} →
              </a>
            </p>
          ))}
        </section>
      </div>
      <section className="card">
        <h2>Payment timeline</h2>
        <ol className="timeline">
          {t.events.map((event, i) => (
            <li key={i}>
              <strong>{event.text}</strong>
              <small>{utc(event.at)}</small>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
