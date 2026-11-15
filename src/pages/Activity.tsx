import { useState } from "react";
import { Badge, Empty, Field, PageHeader, Select, Table } from "../components";
import { useApp } from "../context";
import { utc } from "../domain/selectors";
export function Activity() {
  const { data } = useApp(),
    [search, setSearch] = useState(""),
    [type, setType] = useState("All");
  const rows = data.audit.filter(
    (a) =>
      (type === "All" || a.action === type) &&
      [a.actor, a.entity, a.comment, a.before, a.after].some((v) =>
        v.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Activity"
        title="Activity log"
        description="An immutable local history of who did what, and when."
      />
      <section className="card">
        <div className="toolbar">
          <Field label="Search activity">
            <input
              type="search"
              value={search}
              placeholder="Employee, entity, comment…"
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Select
            label="Action type"
            value={type}
            onChange={setType}
            options={[
              "All",
              "login",
              "logout",
              "issue",
              "review",
              "run",
              "settings",
              "user",
              "workspace",
              "export",
            ]}
          />
        </div>
        {rows.length ? (
          <Table
            caption={`${rows.length} audit events · real action timestamps UTC`}
            headers={[
              "Time · UTC",
              "Employee",
              "Action / entity",
              "Before → after",
              "Comment",
            ]}
          >
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{utc(a.at)}</td>
                <td>
                  {a.actor}
                  <small>{a.role}</small>
                </td>
                <td>
                  <Badge>{a.action}</Badge>
                  <small>
                    <a href={a.link}>{a.entity}</a>
                  </small>
                </td>
                <td className="audit-change">
                  <details>
                    <summary>View change</summary>
                    <strong>Before</strong>
                    <pre>{a.before || "—"}</pre>
                    <strong>After</strong>
                    <pre>{a.after || "—"}</pre>
                  </details>
                </td>
                <td>{a.comment || "—"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No activity matches your search.</Empty>
        )}
      </section>
    </>
  );
}
