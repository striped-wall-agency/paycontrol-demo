import { useState } from "react";
import { Badge, Field, PageHeader, Period, Select, Table } from "../components";
import { useApp } from "../context";
import type { Role, User } from "../domain/types";
export function Settings() {
  const { data, user, mutate, busy } = useApp(),
    [name, setName] = useState(user.name),
    [period, setPeriod] = useState(user.settings),
    [workspace, setWorkspace] = useState(data.workspaceName);
  const blank = {
    id: undefined as string | undefined,
    name: "",
    email: "",
    role: "Operator" as Role,
    active: true,
  };
  const [edit, setEdit] = useState(blank);
  function editUser(u: User) {
    setEdit({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
    });
    document.getElementById("user-name")?.focus();
  }
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Settings"
        title="Settings"
        description="Your profile, preferences and demo workspace."
      />
      <div className="two-columns">
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(
              { type: "settings", name, settings: period },
              "Profile and preferences saved",
            );
          }}
        >
          <h2>Personal preferences</h2>
          <Field label="Profile name">
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Period value={period} onChange={setPeriod} />
          <p className="muted">
            Default reporting period and currency. All timestamps use UTC.
          </p>
          <button className="primary" disabled={busy}>
            Save preferences
          </button>
        </form>
        <section className="card">
          <h2>About this demo</h2>
          <Badge>Local demo · client-side roles</Badge>
          <p>
            Paycontrol by Striped Wall. Fictional Northstar Commerce payments
            with Meridian Pay, November 1–14, 2026.
          </p>
          <p>
            IndexedDB is the only persistent store. Reload preserves data;
            another tab's changes require a reload. Browser storage removal
            clears the demo.
          </p>
          <p>
            No backend, real payments, imports or production authorization. Only
            masked test payment methods.
          </p>
          <p className="muted">
            Schema version {data.schemaVersion} · Revision {data.revision}
          </p>
        </section>
      </div>
      {user.role === "Admin" ? (
        <>
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(
                { type: "workspace", name: workspace },
                "Workspace saved",
              );
            }}
          >
            <h2>Workspace</h2>
            <Field label="Workspace name">
              <input
                required
                maxLength={80}
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
              />
            </Field>
            <button disabled={busy}>Save workspace</button>
          </form>
          <section className="card">
            <h2>Team members</h2>
            <p className="muted">
              Active employees can sign in without a password. Role controls are
              for this demo only.
            </p>
            <Table
              caption="Demo team"
              headers={["Name", "Email", "Role", "Status", "Action"]}
            >
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    {u.id === user.id ? " (you)" : ""}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <Badge>{u.active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td>
                    <button onClick={() => editUser(u)}>
                      Edit {u.name.split(" ")[0]}
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await mutate({ type: "user", ...edit }, "User saved"))
                  setEdit(blank);
              }}
            >
              <h3>{edit.id ? "Edit employee" : "Add employee"}</h3>
              <div className="toolbar">
                <Field label="Employee name">
                  <input
                    id="user-name"
                    required
                    maxLength={80}
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    required
                    value={edit.email}
                    onChange={(e) =>
                      setEdit({ ...edit, email: e.target.value })
                    }
                  />
                </Field>
                <Select
                  label="Role"
                  value={edit.role}
                  onChange={(role) => setEdit({ ...edit, role: role as Role })}
                  options={["Operator", "Admin"]}
                />
                <label className="check">
                  <input
                    type="checkbox"
                    checked={edit.active}
                    onChange={(e) =>
                      setEdit({ ...edit, active: e.target.checked })
                    }
                  />{" "}
                  Active
                </label>
              </div>
              <div className="actions">
                <button className="primary" disabled={busy}>
                  Save employee
                </button>
                {edit.id && (
                  <button type="button" onClick={() => setEdit(blank)}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </section>
        </>
      ) : (
        <div className="callout">
          You are an Operator. An Admin manages workspace settings and
          employees.
        </div>
      )}
    </>
  );
}
