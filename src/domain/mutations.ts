import { mergeResults, reconcile } from "./reconciliation";
import { validateRange } from "./selectors";
import {
  batches,
  type Snapshot,
  type Role,
  type ReviewState,
  type Settings,
  type TransactionFilters,
} from "./types";
export type Command =
  | { type: "login"; userId: string }
  | { type: "logout" }
  | {
      type: "issue";
      id: string;
      state: "Resolved" | "Escalated" | "Monitoring";
      comment: string;
    }
  | { type: "review"; id: string; state: ReviewState; comment: string }
  | { type: "run"; batchId: string }
  | { type: "settings"; name: string; settings: Settings }
  | { type: "filters"; filters: TransactionFilters }
  | {
      type: "user";
      id?: string;
      name: string;
      email: string;
      role: Role;
      active: boolean;
    }
  | { type: "workspace"; name: string }
  | { type: "export"; entity: string };
export function applyCommand(
  input: Snapshot,
  command: Command,
  at = new Date().toISOString(),
  id = crypto.randomUUID(),
): Snapshot {
  const s = structuredClone(input);
  const actor = s.users.find(
    (u) =>
      u.id === (command.type === "login" ? command.userId : s.activeUserId),
  );
  if (!actor?.active)
    throw new Error("Choose an active demo user to continue.");
  const actorRole = actor.role;
  let entity = actor.id,
    link = "/settings",
    before = "",
    after = "",
    comment = "";
  switch (command.type) {
    case "login":
      s.activeUserId = actor.id;
      after = "Signed in";
      link = "/overview";
      break;
    case "logout":
      s.activeUserId = null;
      before = "Signed in";
      after = "Signed out";
      link = "/";
      break;
    case "issue": {
      const issue = s.issues.find((i) => i.id === command.id);
      if (!issue) throw new Error("Issue not found.");
      if (!["Resolved", "Escalated", "Monitoring"].includes(command.state))
        throw new Error("Invalid investigation state.");
      comment = validComment(command.comment);
      before = issue.state;
      after = command.state;
      issue.state = command.state;
      issue.comments.push({
        at,
        author: actor.name,
        text: comment,
        state: after,
      });
      entity = issue.id;
      link = `/issues/${issue.id}`;
      break;
    }
    case "review": {
      const result = s.results.find((r) => r.id === command.id);
      if (!result) throw new Error("Result not found.");
      if (!["Open", "Reviewed", "Resolved"].includes(command.state))
        throw new Error("Invalid review state.");
      comment = validComment(command.comment);
      before = result.reviewState;
      after = command.state;
      result.reviewState = command.state;
      result.comments.push({
        at,
        author: actor.name,
        text: comment,
        state: after,
      });
      entity = result.id;
      link = `/discrepancies/${encodeURIComponent(result.id)}`;
      break;
    }
    case "run": {
      if (!batches.some((b) => b.id === command.batchId))
        throw new Error("Unknown batch.");
      const fresh = reconcile(command.batchId, s.transactions, s.providerRows);
      s.results = mergeResults(s.results, fresh);
      const needsReview = fresh.filter((r) => r.categories.length).length;
      s.runs.push({
        id,
        batchId: command.batchId,
        at,
        author: actor.name,
        matched: fresh.length - needsReview,
        needsReview,
      });
      entity = command.batchId;
      link = "/reconciliation";
      after = `${fresh.length - needsReview} matched, ${needsReview} need review`;
      break;
    }
    case "settings": {
      validateRange(command.settings.start, command.settings.end);
      if (!["USD", "EUR", "All"].includes(command.settings.currency))
        throw new Error("Invalid currency.");
      if (!command.name.trim() || command.name.length > 80)
        throw new Error("Profile name is required (maximum 80 characters).");
      before = JSON.stringify({ name: actor.name, settings: actor.settings });
      actor.name = command.name.trim();
      actor.settings = command.settings;
      after = JSON.stringify({ name: actor.name, settings: actor.settings });
      break;
    }
    case "filters":
      actor.settings.transactionFilters = command.filters;
      return s;
    case "user": {
      requireAdmin(actor.role);
      if (
        !command.name.trim() ||
        command.name.length > 80 ||
        !/^\S+@\S+\.\S+$/.test(command.email)
      )
        throw new Error("Enter a name and valid email.");
      if (!["Admin", "Operator"].includes(command.role))
        throw new Error("Invalid role.");
      if (
        s.users.some(
          (u) =>
            u.id !== command.id &&
            u.email.toLowerCase() === command.email.trim().toLowerCase(),
        )
      )
        throw new Error("Email must be unique.");
      const existing = command.id
        ? s.users.find((u) => u.id === command.id)
        : undefined;
      if (command.id && !existing) throw new Error("User not found.");
      if (existing?.id === actor.id && !command.active)
        throw new Error("You cannot disable yourself.");
      if (
        existing?.role === "Admin" &&
        existing.active &&
        (!command.active || command.role !== "Admin") &&
        !s.users.some(
          (u) => u.id !== existing.id && u.active && u.role === "Admin",
        )
      )
        throw new Error("Keep at least one active Admin.");
      before = existing ? JSON.stringify(existing) : "New user";
      const next = {
        id: existing?.id ?? id,
        name: command.name.trim(),
        email: command.email.trim().toLowerCase(),
        role: command.role,
        active: command.active,
        settings: existing?.settings ?? {
          start: "2026-11-01",
          end: "2026-11-14",
          currency: "All" as const,
        },
      };
      if (existing) Object.assign(existing, next);
      else s.users.push(next);
      entity = next.id;
      after = JSON.stringify(next);
      break;
    }
    case "workspace":
      requireAdmin(actor.role);
      if (!command.name.trim() || command.name.length > 80)
        throw new Error("Workspace name is required (maximum 80 characters).");
      before = s.workspaceName;
      s.workspaceName = command.name.trim();
      after = s.workspaceName;
      entity = "workspace";
      break;
    case "export":
      entity = command.entity;
      link = "/reports";
      after = "CSV exported";
      break;
  }
  s.audit.unshift({
    id,
    at,
    actor: input.users.find((u) => u.id === actor.id)?.name ?? actor.name,
    role: actorRole,
    action: command.type,
    entity,
    link,
    before,
    after,
    comment,
  });
  return s;
}
function validComment(value: string) {
  const text = value.trim();
  if (!text || text.length > 1000)
    throw new Error("A comment of 1–1000 characters is required.");
  return text;
}
function requireAdmin(role: Role) {
  if (role !== "Admin")
    throw new Error("Only an Admin can manage users and workspace settings.");
}
