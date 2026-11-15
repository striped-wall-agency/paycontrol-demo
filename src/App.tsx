import { useEffect, useRef, useState } from "react";
import { AppContext } from "./context";
import { execute, loadSnapshot, RevisionConflict } from "./storage";
import type { Command } from "./domain/mutations";
import type { Snapshot } from "./domain/types";
import { Overview } from "./pages/Overview";
import { Transactions, TransactionDetails } from "./pages/Transactions";
import { Issues, IssueDetails } from "./pages/Issues";
import { Refunds } from "./pages/Refunds";
import { DiscrepancyDetails, Reconciliation } from "./pages/Reconciliation";
import { Reports } from "./pages/Reports";
import { Activity } from "./pages/Activity";
import { Settings } from "./pages/Settings";
import { Empty } from "./components";
const nav = [
  {
    group: "MONITOR",
    items: [
      ["/overview", "Overview", "◫"],
      ["/reports", "Reports", "▥"],
    ],
  },
  {
    group: "OPERATIONS",
    items: [
      ["/transactions", "Transactions", "⇄"],
      ["/issues", "Payment issues", "◇"],
      ["/refunds", "Refunds", "↶"],
      ["/reconciliation", "Reconciliation", "≋"],
    ],
  },
  {
    group: "WORKSPACE",
    items: [
      ["/activity", "Activity log", "◷"],
      ["/settings", "Settings", "⚙"],
    ],
  },
];
function Route({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  let id: string;
  try {
    id = decodeURIComponent(parts[1] ?? "");
  } catch {
    return (
      <Empty>
        Invalid page address. <a href="/overview">Back to overview</a>
      </Empty>
    );
  }
  if (parts.length > 2)
    return (
      <Empty>
        Page not found. <a href="/overview">Back to overview</a>
      </Empty>
    );
  switch (parts[0]) {
    case undefined:
    case "overview":
      return <Overview />;
    case "transactions":
      return id ? <TransactionDetails id={id} /> : <Transactions />;
    case "issues":
      return id ? <IssueDetails id={id} /> : <Issues />;
    case "refunds":
      return <Refunds />;
    case "reconciliation":
      return <Reconciliation />;
    case "discrepancies":
      return <DiscrepancyDetails id={id} />;
    case "reports":
      return <Reports />;
    case "activity":
      return <Activity />;
    case "settings":
      return <Settings />;
    default:
      return (
        <Empty>
          Page not found. <a href="/overview">Back to overview</a>
        </Empty>
      );
  }
}
export default function App() {
  const [data, setData] = useState<Snapshot | null>(null),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [busy, setBusy] = useState(false),
    [path, setPath] = useState(location.pathname + location.search),
    [menu, setMenu] = useState(false);
  const writing = useRef(false);
  async function load() {
    setLoadError("");
    setData(null);
    try {
      setData(await loadSnapshot());
      setConflict(false);
      setError("");
    } catch (cause) {
      setLoadError((cause as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    function pop() {
      setPath(location.pathname + location.search);
    }
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    document.querySelector<HTMLElement>("h1")?.focus();
    setMenu(false);
  }, [path]);
  function navigate(next: string) {
    history.pushState({}, "", next);
    setPath(next);
  }
  useEffect(() => {
    function click(event: MouseEvent) {
      const link = (event.target as Element).closest("a");
      if (
        !link ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0 ||
        link.origin !== location.origin ||
        link.hash ||
        link.download
      )
        return;
      event.preventDefault();
      navigate(link.pathname + link.search);
    }
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  async function mutate(command: Command, message = "Saved") {
    if (!data || writing.current || conflict) return false;
    writing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setData(await execute(command, data.revision));
      setNotice(message);
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      if (cause instanceof RevisionConflict) setConflict(true);
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="loading">
        <div className="brand">
          ▤ Paycontrol<span>by Striped Wall</span>
        </div>
        {loadError ? (
          <>
            <h1>Storage unavailable</h1>
            <p role="alert">{loadError}</p>
            <p>
              Enable IndexedDB for this site, then retry. No changes have been
              saved.
            </p>
            <button className="primary" onClick={load}>
              Retry storage
            </button>
          </>
        ) : (
          <p role="status">Loading your local workspace…</p>
        )}
      </main>
    );
  const user = data.users.find((u) => u.id === data.activeUserId && u.active);
  const feedback = (
    <>
      {error && (
        <div role="alert" className="error">
          {error}
          <button onClick={load}>
            {conflict ? "Reload latest data" : "Reload and retry"}
          </button>
        </div>
      )}
      <div role="status" className={notice ? "notice" : "sr-only"}>
        {notice}
      </div>
    </>
  );
  if (!user)
    return (
      <main className="login-page">
        <div className="login-story">
          <div className="brand">
            ▤ Paycontrol<span>by Striped Wall</span>
          </div>
          <p className="eyebrow">PAYMENT OPERATIONS, CONNECTED</p>
          <h1>
            Clarity for every
            <br />
            payment.
          </h1>
          <p>
            Monitor performance. Investigate exceptions.
            <br />
            Close the gap between your records and your provider.
          </p>
          <div className="login-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <small>Northstar Commerce · Meridian Pay</small>
        </div>
        <section className="login-form">
          <span className="demo-label">Local demo · client-side roles</span>
          <h2>Welcome to Paycontrol</h2>
          <p className="muted">Choose an employee to explore your workspace.</p>
          {feedback}
          {data.users
            .filter((u) => u.active)
            .map((u) => (
              <button
                disabled={busy}
                className="user-choice"
                key={u.id}
                onClick={async () => {
                  if (
                    await mutate(
                      { type: "login", userId: u.id },
                      `Signed in as ${u.name}`,
                    )
                  )
                    navigate("/overview");
                }}
              >
                <span className="avatar">
                  {u.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </span>
                <span className="role">{u.role} →</span>
              </button>
            ))}
          <p className="login-note">
            Fictional data · November 1–14, 2026
            <br />
            Changes stay in this browser's IndexedDB. No password or real
            payment connection.
          </p>
        </section>
      </main>
    );
  return (
    <AppContext.Provider value={{ data, user, busy, mutate, navigate }}>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className={menu ? "sidebar open" : "sidebar"}>
          <a className="brand" href="/overview">
            ▤ Paycontrol<span>by Striped Wall</span>
          </a>
          <div className="workspace-mark">
            <span className="workspace-avatar">N</span>
            <span>
              {data.workspaceName}
              <small>Demo workspace</small>
            </span>
          </div>
          <nav aria-label="Main navigation">
            {nav.map((group) => (
              <div className="nav-group" key={group.group}>
                <p>{group.group}</p>
                {group.items.map(([href, label, icon]) => (
                  <a
                    key={href}
                    href={href}
                    aria-current={path.startsWith(href) ? "page" : undefined}
                  >
                    <span aria-hidden="true">{icon}</span>
                    {label}
                    {href === "/issues" && (
                      <small>
                        {
                          data.issues.filter((i) => i.state !== "Resolved")
                            .length
                        }
                      </small>
                    )}
                  </a>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="online-dot" /> Local workspace
            <p>Demo data · USD / EUR</p>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <button
              className="menu-toggle"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              ☰ Menu
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              {nav
                .flatMap((g) => g.items)
                .find(([href]) => path.startsWith(href))?.[1] ?? "Details"}
            </span>
            <div className="topbar-right">
              <span className="demo-label">Local demo · client-side roles</span>
              <span className="employee">
                <span className="avatar">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span>
                  {user.name}
                  <small>{user.role}</small>
                </span>
              </span>
              <button
                disabled={busy}
                onClick={() => mutate({ type: "logout" }, "Signed out")}
              >
                Log out
              </button>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {feedback}
            <Route key={path} path={path.split("?")[0]} />
            <footer>
              Paycontrol <span>by Striped Wall</span> · Fictional data · All
              times UTC
            </footer>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
