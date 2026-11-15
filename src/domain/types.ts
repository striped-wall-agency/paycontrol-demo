export type Currency = "USD" | "EUR";
export type PaymentStatus = "Succeeded" | "Failed" | "Pending";
export type Role = "Operator" | "Admin";
export type ReviewState = "Open" | "Reviewed" | "Resolved";
export interface Transaction {
  id: string;
  providerRef: string;
  orderId: string;
  customer: string;
  email: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  source: "Checkout" | "Subscription" | "Payment link";
  createdAt: string;
  updatedAt: string;
  accountingDate: string;
  batchId: string;
  method: string;
  chainId: string;
  events: { at: string; text: string }[];
}
export interface ProviderRow {
  id: string;
  canonicalId: string;
  amount: number;
  currency: Currency;
  status: "Settled" | "Declined" | "Pending";
  eventAt: string;
  accountingDate: string;
  batchId: string;
}
export interface Comment {
  at: string;
  author: string;
  text: string;
  state: string;
}
export interface Issue {
  id: string;
  transactionId: string;
  queue: "Failed" | "Pending" | "Needs Review";
  reason: string;
  priority: "High" | "Medium" | "Low";
  state: "Open" | "Resolved" | "Escalated" | "Monitoring";
  comments: Comment[];
}
export interface Refund {
  id: string;
  transactionId: string;
  amount: number;
  currency: Currency;
  status: "Requested" | "Processing" | "Succeeded" | "Failed";
  createdAt: string;
  reason: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  settings: Settings;
}
export interface Settings {
  start: string;
  end: string;
  currency: Currency | "All";
  transactionFilters?: TransactionFilters;
}
export interface TransactionFilters {
  search: string;
  start: string;
  end: string;
  currency: Currency | "All";
  status: string;
  source: string;
  min: string;
  max: string;
  sort: "date" | "amount" | "status";
  direction: "asc" | "desc";
  page: number;
}
export interface Result {
  id: string;
  batchId: string;
  canonicalId: string;
  accountingDate: string;
  internal: Transaction[];
  provider: ProviderRow[];
  categories: string[];
  reviewState: ReviewState;
  comments: Comment[];
  fingerprint: string;
}
export interface Run {
  id: string;
  batchId: string;
  at: string;
  author: string;
  matched: number;
  needsReview: number;
}
export interface Audit {
  id: string;
  at: string;
  actor: string;
  role: Role;
  action: string;
  entity: string;
  link: string;
  before: string;
  after: string;
  comment: string;
}
export interface Snapshot {
  schemaVersion: 1;
  revision: number;
  transactions: Transaction[];
  providerRows: ProviderRow[];
  issues: Issue[];
  refunds: Refund[];
  results: Result[];
  runs: Run[];
  users: User[];
  activeUserId: string | null;
  audit: Audit[];
  workspaceName: string;
}
export const batches = [
  {
    id: "BATCH-01",
    name: "November 1–7, 2026",
    start: "2026-11-01",
    end: "2026-11-07",
  },
  {
    id: "BATCH-02",
    name: "November 8–14, 2026",
    start: "2026-11-08",
    end: "2026-11-14",
  },
];
export const defaultSettings: Settings = {
  start: "2026-11-01",
  end: "2026-11-14",
  currency: "All",
};
export const defaultFilters: TransactionFilters = {
  ...defaultSettings,
  search: "",
  status: "All",
  source: "All",
  min: "",
  max: "",
  sort: "date",
  direction: "desc",
  page: 1,
};
