import type { DriftCell } from "@/app/page";

export const DEMO_COLORS: Array<DriftCell["color"]> = [
  "green", "red", "red", "yellow", "red",
  "green", "red", "red", "yellow", "red",
  "red",   "red", "green",
];

// Computed once so page.tsx and Map.tsx share the same numbers
const counts = DEMO_COLORS.reduce(
  (acc, c) => { acc[c]++; return acc; },
  { green: 0, yellow: 0, red: 0 },
);
const total = DEMO_COLORS.length;

export const DEMO_ZONE = {
  good:      Math.round((counts.green  / total) * 100), // 23
  attention: Math.round((counts.yellow / total) * 100), // 15
  risk:      Math.round((counts.red    / total) * 100), // 62
};
