import { handleMCPRequest } from "@intent/mcp-server";
import { withProjectLock, recordAnswerLearning, recordInterviewMetrics } from "@intent/core";
import { IncomingMessage, ServerResponse } from "node:http";
import {
  CreatePatchInputSchema,
  UpdatePatchInputSchema,
  SendPatchesInputSchema,
  ResolvePatchInputSchema,
  PatchListQuerySchema,
  InterviewAnswerInputSchema,
  Feedback,
  InterviewState,
} from "@intent/schema";
import { buildPreviewDocument } from "@intent/studio";
import {
  ApiContext,
  newPatchId,
  lockedWithDescendants,
  sendJson,
  sendSchemaError,
  readJsonBody,
  readQueue,
  saveBeforeSendVersion,
  CHIP_LABELS,
  sendBodyError,
  sanitizeErrorMessage,
} from "./api-helpers.js";

/** GET /api/scene â€” full scene + locks for the Studio shell (trd 11.3). */
export async function handleApiScene(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sceneId = url.searchParams.get("scene") || "default";
  const scene = await ctx.storage.readScene(sceneId);
  if (!scene) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Scene not found" } });
    return;
  }
  const lockedRaw = await ctx.lockPort.getLockedObjects(sceneId);
  sendJson(res, 200, { scene, locked: lockedWithDescendants(scene, lockedRaw), revision: scene.revision });
}

/** GET /api/preview â€” the preview document for the iframe srcdoc (trd 12.1). */
export async function handleApiPreview(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sceneId = url.searchParams.get("scene") || "default";
  const scene = await ctx.storage.readScene(sceneId);
  if (!scene) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Scene not found");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(buildPreviewDocument(scene));
}

/** GET /api/patches[?status=&scene=] â€” newest first, max 200, nextCursor always null (no pagination yet). */
function encodeCursor(item: { createdAt: string; id: string }): string {
  return Buffer.from(JSON.stringify([item.createdAt, item.id])).toString("base64url");
}

function decodeCursor(cursor: string): { at: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" || typeof parsed[1] !== "string") {
      return null;
    }
    return { at: parsed[0], id: parsed[1] };
  } catch {
    return null;
  }
}

export async function handleApiPatchList(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const limitParam = url.searchParams.get("limit");
  let query;
  try {
    query = PatchListQuerySchema.parse({
      sceneId: url.searchParams.get("scene") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: limitParam !== null && limitParam !== "" ? Number(limitParam) : undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
  } catch (err) {
    sendSchemaError(res, err);
    return;
  }
  let cursor: { at: string; id: string } | null = null;
  if (query.cursor) {
    cursor = decodeCursor(query.cursor);
    if (!cursor) {
      sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid cursor" } });
      return;
    }
  }
  const items = (await readQueue(ctx.storage, query.sceneId))
    .filter((f) => !query.status || f.status === query.status)
    .filter((f) => {
      if (!cursor) return true;
      // newest-first ordering; next page = items strictly older than the cursor entry
      return f.createdAt < cursor.at || (f.createdAt === cursor.at && f.id < cursor.id);
    })
    .slice()
    .sort((a, b) => (b.createdAt + b.id).localeCompare(a.createdAt + a.id));
  const page = items.slice(0, query.limit);
  const nextCursor = page.length === query.limit && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null;
  sendJson(res, 200, { patches: page, nextCursor });
}

/** POST /api/patches â€” create a draft feedback patch for one object (design.md 4.3). */
export async function handleApiPatchCreate(ctx: ApiContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
  let body: unknown;
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (err) {
    sendBodyError(res, err);
    return;
  }
  let input;
  try {
    input = CreatePatchInputSchema.parse(body);
  } catch (err) {
    sendSchemaError(res, err);
    return;
  }
  const scene = await ctx.storage.readScene(input.sceneId);
  if (!scene) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Scene not found" } });
    return;
  }
  if (!scene.objects[input.objectId] && !scene.screens[input.objectId]) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Object or screen not found in scene" } });
    return;
  }
  const text = (input.feedback.text ?? "").trim();
  const chips = input.feedback.chips;
  const chipLabel = chips.map((c) => CHIP_LABELS[c] ?? c).join(", ");
  // Annotation-only feedback is valid input (see the create refine) but the
  // queue invariant requires a non-empty message, so derive one deterministically.
  const message = text || chipLabel || `Annotation attached (${input.feedback.annotationIds.length})`;
  const item: Feedback = {
    id: newPatchId(),
    sceneId: input.sceneId,
    objectId: input.objectId,
    kind: "visual",
    message,
    severity: "medium",
    status: "draft",
    chips,
    baseRevision: input.baseRevision,
    createdAt: new Date().toISOString(),
    sentAt: null,
    appliedAt: null,
    patchId: null,
    annotationIds: input.feedback.annotationIds,
  };
  const queue = await readQueue(ctx.storage, input.sceneId);
  queue.push(item);
  await ctx.storage.writeFeedback(input.sceneId, queue);
  ctx.broadcastPatchChanged(input.sceneId, item.id, "draft");
  sendJson(res, 201, { patch: item });

  });
}

/** PATCH /api/patches/:id â€” edit a draft (text and/or chips). */
export async function handleApiPatchUpdate(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
  let body: unknown;
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (err) {
    sendBodyError(res, err);
    return;
  }
  let input;
  try {
    input = UpdatePatchInputSchema.parse(body);
  } catch (err) {
    sendSchemaError(res, err);
    return;
  }
  const queue = await readQueue(ctx.storage, input.sceneId);
  const idx = queue.findIndex((f) => f.id === id);
  if (idx === -1) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Patch not found" } });
    return;
  }
  if (queue[idx]!.status !== "draft") {
    sendJson(res, 409, { error: { code: "E_CONFLICT", message: "Only drafts can be edited" } });
    return;
  }
  const text = input.feedback.text !== undefined ? input.feedback.text.trim() : queue[idx]!.message;
  const chips = input.feedback.chips !== undefined ? input.feedback.chips : queue[idx]!.chips;
  if (!text && chips.length === 0) {
    sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "feedback.text or at least one chip is required" } });
    return;
  }
  const item: Feedback = {
    ...queue[idx]!,
    message: text || chips.map((c) => CHIP_LABELS[c] ?? c).join(" Â· "),
    chips,
  };
  queue[idx] = item;
  await ctx.storage.writeFeedback(input.sceneId, queue);
  ctx.broadcastPatchChanged(input.sceneId, item.id, "draft");
  sendJson(res, 200, { patch: item });

  });
}

/** DELETE /api/patches/:id â€” discard a draft. */
export async function handleApiPatchDelete(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
  const url = new URL(req.url ?? "", "http://127.0.0.1/");
  const sceneId = url.searchParams.get("scene") || "default";
  const queue = await readQueue(ctx.storage, sceneId);
  const idx = queue.findIndex((f) => f.id === id);
  if (idx === -1) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Patch not found" } });
    return;
  }
  if (queue[idx]!.status !== "draft") {
    sendJson(res, 409, { error: { code: "E_CONFLICT", message: "Only drafts can be discarded" } });
    return;
  }
  queue.splice(idx, 1);
  await ctx.storage.writeFeedback(sceneId, queue);
  ctx.broadcastPatchChanged(sceneId, id, "discarded");
  res.writeHead(204);
  res.end();

  });
}

/** POST /api/patches/send â€” mark drafts as sent + save a before-send version (trd 6.4, 9.6). */
export async function handleApiPatchSend(ctx: ApiContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
  let body: unknown;
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (err) {
    sendBodyError(res, err);
    return;
  }
  let input;
  try {
    input = SendPatchesInputSchema.parse(body);
  } catch (err) {
    sendSchemaError(res, err);
    return;
  }
  const queue = await readQueue(ctx.storage, input.sceneId);
  const ids = new Set(input.ids ?? queue.filter((f) => f.status === "draft").map((f) => f.id));
  if (ids.size === 0) {
    sendJson(res, 200, { patches: [] });
    return;
  }
  const now = new Date().toISOString();
  const sent: Feedback[] = [];
  const updated = queue.map((f) => {
    if (f.status === "draft" && ids.has(f.id)) {
      const item: Feedback = { ...f, status: "sent", sentAt: now };
      sent.push(item);
      return item;
    }
    return f;
  });
  await ctx.storage.writeFeedback(input.sceneId, updated);
  await saveBeforeSendVersion(ctx.storage, ctx.projectRoot, input.sceneId);
  // Flip any annotations referenced by the sent feedback items from open to
  // sent so they become visible to get_feedback (trd 9.7).
  const sentAnnotationIds = new Set(sent.flatMap((f) => f.annotationIds));
  if (sentAnnotationIds.size > 0) {
    const annotations = await ctx.storage.readAnnotations(input.sceneId);
    let changed = false;
    const flipped = annotations.map((a) => {
      if (a.status === "open" && sentAnnotationIds.has(a.id)) {
        changed = true;
        return { ...a, status: "sent" as const };
      }
      return a;
    });
    if (changed) {
      await ctx.storage.writeAnnotations(input.sceneId, flipped);
    }
  }
  for (const item of sent) {
    ctx.broadcastPatchChanged(input.sceneId, item.id, "sent");
  }
  sendJson(res, 200, { patches: sent });

  });
}

/** POST /api/patches/:id/resolve â€” resolve a conflict: keep-mine (re-draft) or take-agents (applied). */
export async function handleApiPatchResolve(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
  let body: unknown;
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (err) {
    sendBodyError(res, err);
    return;
  }
  let input;
  try {
    input = ResolvePatchInputSchema.parse(body);
  } catch (err) {
    sendSchemaError(res, err);
    return;
  }
  const queue = await readQueue(ctx.storage, input.sceneId);
  const idx = queue.findIndex((f) => f.id === id);
  if (idx === -1) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Patch not found" } });
    return;
  }
  if (queue[idx]!.status !== "conflict") {
    sendJson(res, 409, { error: { code: "E_CONFLICT", message: "Only conflicted patches can be resolved" } });
    return;
  }
  const item: Feedback =
    input.choice === "keep-mine"
      ? { ...queue[idx]!, status: "draft", sentAt: null }
      : { ...queue[idx]!, status: "applied", appliedAt: new Date().toISOString() };
  queue[idx] = item;
  await ctx.storage.writeFeedback(input.sceneId, queue);
  ctx.broadcastPatchChanged(input.sceneId, item.id, item.status);
  sendJson(res, 200, { patch: item });

  });
}


/** POST /api/mcp â€” the MCP-over-HTTP endpoint used by the agents and the Studio (trd 11.3). */
export async function handleMcp(ctx: ApiContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (err) {
    sendBodyError(res, err);
    return;
  }
  try {
    const { tool, input } = body as { tool: string; input: unknown };
    let patchSceneId: string | undefined;
    if (tool === "apply_patch" && input && typeof input === "object") {
      const maybePatch = (input as { patch?: unknown }).patch as { sceneId?: unknown } | undefined;
      if (maybePatch && typeof maybePatch.sceneId === "string") {
        patchSceneId = maybePatch.sceneId;
      }
    }
    const result = await handleMCPRequest(tool, input, {
      projectRoot: ctx.projectRoot,
      storage: ctx.storage,
      lockPort: ctx.lockPort,
      crypto: ctx.crypto,
      notify: (event: string, payload: unknown) => {
        const p = payload as { sceneId?: unknown; id?: unknown; status?: unknown } | undefined;
        if (
          event === "patch.changed" &&
          typeof p?.sceneId === "string" &&
          typeof p?.id === "string" &&
          typeof p?.status === "string"
        ) {
          ctx.broadcastPatchChanged(p.sceneId, p.id, p.status);
        } else if (event === "interview.changed" && typeof p?.status === "string") {
          ctx.broadcastInterviewChanged(p.status);
        }
      },
    });
    // Real-time studio: after a successful patch, broadcast the new revision
    // to any connected SSE clients (S-1-12).
    if (
      tool === "apply_patch" &&
      patchSceneId &&
      result &&
      typeof result === "object" &&
      (result as { success?: boolean; revision?: number }).success === true &&
      typeof (result as { revision?: number }).revision === "number"
    ) {
      ctx.broadcastRevision(patchSceneId, (result as { revision: number }).revision);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, result }));
  } catch (error) {
    const intentError = error as { code?: unknown };
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: typeof intentError.code === "string" ? intentError.code : "E_INTERNAL",
          message: sanitizeErrorMessage((error as Error).message),
        },
      })
    );
  }
}

function freshInterviewState(): InterviewState {
  return {
    version: 1,
    status: "not_started",
    currentQuestionIndex: 0,
    meter: 0,
    meterTopics: {},
    requiredTopics: [],
    answeredTopics: [],
    delegated: false,
    delegatedAt: null,
    briefId: null,
    updatedAt: new Date().toISOString(),
    pendingQuestion: null,
    answers: [],
  };
}

/** GET /api/interview — the interview state (.intent/interview/state.json). */
export async function handleApiInterviewGet(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, _url: URL): Promise<void> {
  const state = (await ctx.storage.readInterviewState()) ?? freshInterviewState();
  sendJson(res, 200, { state });
}

/** POST /api/interview/answer — record a Studio-side answer; consumed by get_feedback exactly once. */
export async function handleApiInterviewAnswer(ctx: ApiContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  return withProjectLock(ctx.lockPort, "interview-state", async () => {
  let body: unknown;
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (err) {
    sendBodyError(res, err);
    return;
  }
  let input;
  try {
    input = InterviewAnswerInputSchema.parse(body);
  } catch (err) {
    sendSchemaError(res, err);
    return;
  }
  const state = (await ctx.storage.readInterviewState()) ?? freshInterviewState();
  const existingStudio = state.answers.find((a) => a.questionId === input.questionId && a.via === "studio");
  if (existingStudio) {
    // Idempotent: a re-send for the same question returns the current state unchanged.
    sendJson(res, 200, { state });
    return;
  }
  // Attribute the answered kind ONLY when the answer actually targets the pending
  // question — a stale/double Studio answer must not be attributed to whatever
  // question happens to be pending now.
  const answeredKind =
    state.pendingQuestion && state.pendingQuestion.questionId === input.questionId ? state.pendingQuestion.kind : null;
  const now = new Date().toISOString();
  state.answers.push({ questionId: input.questionId, answer: input.answer, via: "studio", answeredAt: now, consumed: false });
  if (state.pendingQuestion?.questionId === input.questionId) {
    state.pendingQuestion = null;
  }
  // trd 17.1: learn from the Studio answer too (best effort; never blocks recording).
  await recordAnswerLearning(ctx.storage, input.answer, input.questionId, now);
  // Summary "Exactly right" marks the interview complete (trd 10.2); anything else stays in progress.
  const answer = input.answer as { summaryChoice?: string } | null;
  if (answer && answer.summaryChoice === "exactly-right") {
    state.status = "complete";
  } else if (state.status !== "complete") {
    state.status = "in_progress";
  }
  state.updatedAt = now;
  await ctx.storage.writeInterviewState(state);
  // intent.md §12 — record session telemetry (best effort; never blocks the answer).
  // NOTE: `kind: null` on purpose — the "start a new interview" signal belongs to
  // the ask path (ask_user). Passing the answered kind here would let the recorder
  // mark the live session abandoned on every Studio answer to the first question.
  await recordInterviewMetrics(ctx.storage, {
    kind: null,
    currentQuestionIndex: state.currentQuestionIndex,
    meterAfter: state.meter,
    capped: false,
    preFilledShown: false,
    recordedAnswer: { answer: input.answer, questionKind: answeredKind },
    now,
  });
  ctx.broadcastInterviewChanged(state.status);
  sendJson(res, 201, { state });

  });
}

