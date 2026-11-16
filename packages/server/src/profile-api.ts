import { IncomingMessage, ServerResponse } from "node:http";
import { withProjectLock } from "@intent/core";
import { IntentProfileEntrySchema } from "@intent/schema";
import {
  ApiContext,
  sendJson,
} from "./api-helpers.js";

/**
 * trd 17.1 — the Intent Profile, surfaced for the Studio settings view.
 * List every entry, edit the human-facing `text` (the normalized phrase,
 * max 200 chars), or delete an entry. Key/value/confidence are NOT editable
 * through this route: editing them would defeat the normalization that keeps
 * the profile free of scene text.
 */

const PROFILE_ID = /^q_[0-9A-HJKMNP-TV-Z]{26}$/;

export async function handleProfileIntentList(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, _url: URL): Promise<void> {
  const profile = await ctx.storage.readIntentProfile();
  sendJson(res, 200, { entries: profile.entries });
}

async function readModifyWrite(ctx: ApiContext, fn: (entries: IntentProfileEntryLike[]) => IntentProfileEntryLike[] | { error: { status: number; code: string; message: string } }): Promise<
  { ok: true; entries: IntentProfileEntryLike[] } | { ok: false; error: { status: number; code: string; message: string } }
> {
  return withProjectLock(ctx.lockPort, "intent-profile", async () => {
    const profile = await ctx.storage.readIntentProfile();
    const result = fn([...profile.entries]);
    if (!Array.isArray(result)) {
      return { ok: false, error: result.error };
    }
    const next = { schemaVersion: 1 as const, entries: result };
    await ctx.storage.writeIntentProfile(next);
    return { ok: true, entries: next.entries };
  });
}

export type IntentProfileEntryLike = import("@intent/schema").IntentProfileEntry;

export async function handleProfileIntentPatch(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, _url: URL, id: string): Promise<void> {
  if (!PROFILE_ID.test(id)) {
    sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid profile entry id" } });
    return;
  }
  let body: unknown;
  try {
    body = await new Promise((resolvePromise, rejectPromise) => {
      let raw = "";
      req.setEncoding("utf-8");
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 64 * 1024) {
          rejectPromise(new Error("too large"));
          req.destroy();
        }
      });
      req.on("end", () => {
        try {
          resolvePromise(raw.length ? JSON.parse(raw) : {});
        } catch {
          rejectPromise(new Error("invalid json"));
        }
      });
      req.on("error", rejectPromise);
    });
  } catch (err) {
    const message = (err as Error).message === "too large" ? "Payload too large" : "Request body is not valid JSON";
    sendJson(res, (err as Error).message === "too large" ? 413 : 400, { error: { code: "E_BAD_REQUEST", message } });
    return;
  }
  const text = (body as { text?: unknown }).text;
  if (typeof text !== "string" || text.trim().length === 0 || text.trim().length > 200) {
    sendJson(res, 400, { error: { code: "E_SCHEMA", message: "text must be a non-empty string of at most 200 characters" } });
    return;
  }
  const now = new Date().toISOString();
  const outcome = await readModifyWrite(ctx, (entries) => {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) {
      return { error: { status: 404, code: "E_NOT_FOUND", message: "Entry not found" } };
    }
    const current = entries[idx] as IntentProfileEntryLike;
    const updated = {
      ...current,
      text: text.trim(),
      updatedAt: now,
    };
    IntentProfileEntrySchema.parse(updated);
    entries[idx] = updated;
    return entries;
  });
  if (!outcome.ok) {
    sendJson(res, outcome.error.status, { error: { code: outcome.error.code, message: outcome.error.message } });
    return;
  }
  sendJson(res, 200, { ok: true, entry: outcome.entries.find((e) => e.id === id) });
}

export async function handleProfileIntentDelete(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, _url: URL, id: string): Promise<void> {
  if (!PROFILE_ID.test(id)) {
    sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid profile entry id" } });
    return;
  }
  const outcome = await readModifyWrite(ctx, (entries) => {
    const next = entries.filter((e) => e.id !== id);
    if (next.length === entries.length) {
      return { error: { status: 404, code: "E_NOT_FOUND", message: "Entry not found" } };
    }
    return next;
  });
  if (!outcome.ok) {
    sendJson(res, outcome.error.status, { error: { code: outcome.error.code, message: outcome.error.message } });
    return;
  }
  sendJson(res, 200, { ok: true });
}

/** Dispatches /api/profile-intent routes. Returns true when handled. */
export async function registerProfileRoutes(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): Promise<boolean> {
  if (pathname === "/api/profile-intent" && req.method === "GET") {
    await handleProfileIntentList(ctx, req, res, url);
    return true;
  }
  const match = /^\/api\/profile-intent\/([^/]+)$/.exec(pathname);
  if (match && req.method === "PATCH") {
    await handleProfileIntentPatch(ctx, req, res, url, match[1] ?? "");
    return true;
  }
  if (match && req.method === "DELETE") {
    await handleProfileIntentDelete(ctx, req, res, url, match[1] ?? "");
    return true;
  }
  return false;
}
