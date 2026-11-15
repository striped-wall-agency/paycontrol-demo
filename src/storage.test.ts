import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { execute, loadSnapshot } from "./storage";
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("paycontrol-demo-v1");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});
it("seeds once, persists decisions and audit atomically, rejects stale writes", async () => {
  let s = await loadSnapshot();
  expect(s.revision).toBe(0);
  s = await execute({ type: "login", userId: "user-operator" }, s.revision);
  const old = s.revision;
  s = await execute(
    {
      type: "issue",
      id: s.issues[0].id,
      state: "Monitoring",
      comment: "Awaiting provider",
    },
    s.revision,
  );
  await expect(execute({ type: "logout" }, old)).rejects.toThrow("Another tab");
  const loaded = await loadSnapshot();
  expect(loaded).toEqual(s);
  expect(loaded.audit[0]).toMatchObject({
    action: "issue",
    after: "Monitoring",
  });
  await expect(
    execute({ type: "workspace", name: "Unauthorized" }, s.revision),
  ).rejects.toThrow("Admin");
  expect(await loadSnapshot()).toEqual(loaded);
});
it("serializes concurrent tabs so only one writes the same revision", async () => {
  const s = await loadSnapshot();
  const results = await Promise.allSettled([
    execute({ type: "login", userId: "user-operator" }, s.revision),
    execute({ type: "login", userId: "user-admin" }, s.revision),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await loadSnapshot()).audit).toHaveLength(1);
});
