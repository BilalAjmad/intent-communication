import { withProjectLock } from "@intent/core";
import { IncomingMessage, ServerResponse } from "node:http";
import {
  CreateAnnotationInputSchema,
  SafeIdSchema,
  Annotation,
} from "@intent/schema";
import {
  ApiContext,
  newAnnotationId,
  sendJson,
  sendSchemaError,
  readJsonBody,
  readRawBody,
  sendBodyError,
  IntentError,
} from "./api-helpers.js";

/**
 * Annotations API (trd 9.7): vector annotations are always saved; PNGs are
 * produced browser-side and stored server-side (1 MB cap, magic bytes + IHDR).
 * Agents never reach this surface — it is the Studio's overlay API.
 * Wired into the route table by `registerAnnotationRoutes` (server/index.ts).
 */

/** sceneId from the query string (SafeIdSchema), 400 on invalid; defaults to "default". */
function parseSceneId(url: URL, res: ServerResponse): string | null {
  const raw = url.searchParams.get("sceneId") ?? "default";
  const parsed = SafeIdSchema.safeParse(raw);
  if (!parsed.success) {
    sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid sceneId" } });
    return null;
  }
  return parsed.data;
}

function parseAnnotationId(id: string, res: ServerResponse): string | null {
  if (!/^a_[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) {
    sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid annotation id" } });
    return null;
  }
  return id;
}

/** POST /api/annotations — save a vector annotation. id/createdAt assigned here; status=open. */
export async function handleApiAnnotationCreate(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
    const sceneId = parseSceneId(url, res);
    if (!sceneId) return;
    let body: unknown;
    try {
      body = await readJsonBody(req, 1_000_000);
    } catch (err) {
      sendBodyError(res, err);
      return;
    }
    let input;
    try {
      input = CreateAnnotationInputSchema.parse(body);
    } catch (err) {
      sendSchemaError(res, err);
      return;
    }
    const item: Annotation = {
      schemaVersion: 1,
      id: newAnnotationId(),
      status: "open",
      createdAt: new Date().toISOString(),
      ...input,
    };
    const annotations = await ctx.storage.readAnnotations(sceneId);
    annotations.push(item);
    await ctx.storage.writeAnnotations(sceneId, annotations);
    sendJson(res, 201, { annotation: item });
  });
}

/** GET /api/annotations?sceneId=&screenId= — list annotations for the Studio overlay. */
export async function handleApiAnnotationList(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sceneId = parseSceneId(url, res);
  if (!sceneId) return;
  const list = await ctx.storage.readAnnotations(sceneId);
  const screenId = url.searchParams.get("screenId");
  const annotations = screenId ? list.filter((a) => a.screenId === screenId) : list;
  sendJson(res, 200, { annotations });
}

/** PUT /api/annotations/:id/image — raw PNG (max 1 MB); magic bytes + IHDR checked; sets annotation.image. 204 on success. */
export async function handleApiAnnotationImage(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL, id: string): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
    const sceneId = parseSceneId(url, res);
    if (!sceneId) return;
    const annotationId = parseAnnotationId(id, res);
    if (!annotationId) return;
    const contentType = req.headers["content-type"];
    if (contentType !== "image/png") {
      sendJson(res, 415, { error: { code: "E_BAD_REQUEST", message: "Content-Type must be image/png" } });
      return;
    }
    let png: Buffer;
    try {
      png = await readRawBody(req, 1_000_000);
    } catch (err) {
      sendBodyError(res, err);
      return;
    }
    const annotations = await ctx.storage.readAnnotations(sceneId);
    const index = annotations.findIndex((a) => a.id === annotationId);
    if (index === -1) {
      sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Annotation not found" } });
      return;
    }
    let written;
    try {
      written = await ctx.storage.writeAnnotationImage(sceneId, annotationId, png);
    } catch (err) {
      if (err instanceof IntentError && err.code === "E_BAD_REQUEST") {
        sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: err.message } });
        return;
      }
      throw err;
    }
    annotations[index] = {
      ...annotations[index]!,
      image: { file: written.file, width: written.width, height: written.height, bytes: png.length },
    };
    await ctx.storage.writeAnnotations(sceneId, annotations);
    res.writeHead(204);
    res.end();
  });
}

/** DELETE /api/annotations/:id — discard an OPEN annotation (sent ones are agent context). */
export async function handleApiAnnotationDelete(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL, id: string): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
    const sceneId = parseSceneId(url, res);
    if (!sceneId) return;
    const annotationId = parseAnnotationId(id, res);
    if (!annotationId) return;
    const annotations = await ctx.storage.readAnnotations(sceneId);
    const target = annotations.find((a) => a.id === annotationId);
    if (!target) {
      sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Annotation not found" } });
      return;
    }
    if (target.status !== "open") {
      sendJson(res, 409, { error: { code: "E_CONFLICT", message: "Only open annotations can be deleted" } });
      return;
    }
    await ctx.storage.writeAnnotations(
      sceneId,
      annotations.filter((a) => a.id !== annotationId),
    );
    sendJson(res, 200, { deleted: annotationId });
  });
}

/**
 * Dispatches the /api/annotations route family. Returns true when the request
 * was handled, so the caller can short-circuit.
 */
export async function registerAnnotationRoutes(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): Promise<boolean> {
  if (pathname === "/api/annotations" && req.method === "GET") {
    await handleApiAnnotationList(ctx, req, res, url);
    return true;
  }
  if (pathname === "/api/annotations" && req.method === "POST") {
    await handleApiAnnotationCreate(ctx, req, res, url);
    return true;
  }
  const annotationMatch = /^\/api\/annotations\/([^/]+)(\/image)?$/.exec(pathname);
  if (annotationMatch && req.method === "PUT" && annotationMatch[2] === "/image") {
    await handleApiAnnotationImage(ctx, req, res, url, annotationMatch[1] ?? "");
    return true;
  }
  if (annotationMatch && req.method === "DELETE" && !annotationMatch[2]) {
    await handleApiAnnotationDelete(ctx, req, res, url, annotationMatch[1] ?? "");
    return true;
  }
  return false;
}
