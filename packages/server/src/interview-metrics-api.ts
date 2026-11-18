import { IncomingMessage, ServerResponse } from "node:http";
import { summarizeInterviewMetrics } from "@intent/core";
import { ApiContext, sendJson } from "./api-helpers.js";

/**
 * intent.md §12 / TC-MET-04 — the interview efficiency report, computed on
 * demand from `.intent/metrics.json` (gitignored, never sent anywhere).
 * Studio Profile tab renders this; nothing leaves the machine.
 */
export async function handleInterviewMetrics(ctx: ApiContext, res: ServerResponse): Promise<void> {
  const metrics = await ctx.storage.readInterviewMetrics();
  sendJson(res, 200, { ok: true, report: summarizeInterviewMetrics(metrics) });
}

/** Dispatches /api/interview-metrics. Returns true when handled. */
export async function registerInterviewMetricsRoutes(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  _url: URL,
): Promise<boolean> {
  if (pathname === "/api/interview-metrics" && req.method === "GET") {
    await handleInterviewMetrics(ctx, res);
    return true;
  }
  return false;
}
