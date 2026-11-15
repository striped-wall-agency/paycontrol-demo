import { createContext, useContext } from "react";
import type { Snapshot, User } from "./domain/types";
import type { Command } from "./domain/mutations";
export interface AppContextValue {
  data: Snapshot;
  user: User;
  busy: boolean;
  mutate: (command: Command, message?: string) => Promise<boolean>;
  navigate: (path: string) => void;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("App context unavailable");
  return value;
}
