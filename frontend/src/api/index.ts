export * from "./awardCases";
export * from "./recipients";
export * from "./council";
export * from "./ai";
export * from "./invite";
export * from "./stats";

import { api } from "./client";
export const seedDemoData = (n = 50) =>
  api.post<{ demo_cases: string[]; demo_recipients: number }>(
    `/api/council/seed-demo?n=${n}`
  ).then((r) => r.data);
