import { useState, type ReactNode } from "react";
import type { Comment, Currency, Settings } from "./domain/types";
import { utc } from "./domain/selectors";
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={`badge ${String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      {children}
    </span>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
}
export function Period({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (value: Settings) => void;
}) {
  return (
    <div className="toolbar">
      <Field label="From · UTC">
        <input
          type="date"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </Field>
      <Field label="To · UTC">
        <input
          type="date"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
        />
      </Field>
      <Select
        label="Currency"
        value={value.currency}
        options={["All", "USD", "EUR"]}
        onChange={(currency) =>
          onChange({ ...value, currency: currency as Currency | "All" })
        }
      />
    </div>
  );
}
export function Table({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        ◇
      </span>
      <h3>Nothing here yet</h3>
      <p>{children}</p>
    </div>
  );
}
export function History({ comments }: { comments: Comment[] }) {
  return (
    <section className="card">
      <h2>Decision history</h2>
      {!comments.length ? (
        <p className="muted">No investigation decisions yet.</p>
      ) : (
        <ol className="timeline">
          {comments.map((c, i) => (
            <li key={i}>
              <strong>{c.state}</strong> · {c.author}
              <small>{utc(c.at)}</small>
              <p>{c.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
export function DecisionForm({
  options,
  onSave,
  busy,
}: {
  options: string[];
  onSave: (state: string, comment: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [state, setState] = useState(options[0]),
    [comment, setComment] = useState("");
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSave(state, comment)) setComment("");
      }}
    >
      <h2>Investigation decision</h2>
      <p className="muted">
        Records a review decision. Source financial facts remain unchanged.
      </p>
      <Select
        label="Decision"
        value={state}
        onChange={setState}
        options={options}
      />
      <Field label="Comment · required">
        <textarea
          required
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
        />
      </Field>
      <small>{comment.length}/1000 characters</small>
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Save decision"}
      </button>
    </form>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 tabIndex={-1}>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
