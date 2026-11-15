import { createSeed } from "./domain/seed";
import { applyCommand, type Command } from "./domain/mutations";
import type { Snapshot } from "./domain/types";
const DATABASE = "paycontrol-demo-v1";
export class RevisionConflict extends Error {
  constructor() {
    super(
      "Another tab saved changes. Reload to use the latest data; your change was not saved.",
    );
  }
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("snapshots");
    request.onerror = () =>
      reject(request.error ?? new Error("Cannot open IndexedDB."));
    request.onblocked = () =>
      reject(
        new Error(
          "Storage upgrade is blocked. Close other Paycontrol tabs and retry.",
        ),
      );
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
export async function loadSnapshot(): Promise<Snapshot> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite"),
      store = tx.objectStore("snapshots"),
      get = store.get("current");
    let snapshot: Snapshot;
    get.onsuccess = () => {
      snapshot = get.result ?? createSeed();
      if (snapshot.schemaVersion !== 1) {
        tx.abort();
        return;
      }
      if (!get.result) store.add(snapshot, "current");
    };
    tx.oncomplete = () => {
      db.close();
      resolve(snapshot);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        tx.error ??
          new Error(
            "Storage could not be loaded. No temporary fallback is used.",
          ),
      );
    };
  });
}
export async function execute(
  command: Command,
  revision: number,
): Promise<Snapshot> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite"),
      store = tx.objectStore("snapshots"),
      get = store.get("current");
    let next: Snapshot, error: unknown;
    get.onsuccess = () => {
      try {
        const current: Snapshot = get.result;
        if (!current || current.revision !== revision)
          throw new RevisionConflict();
        next = applyCommand(current, command);
        next.revision = current.revision + 1;
        store.put(next, "current");
      } catch (cause) {
        error = cause;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(next);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        error ??
          tx.error ??
          new Error("Storage write failed. Your change was not saved."),
      );
    };
  });
}
