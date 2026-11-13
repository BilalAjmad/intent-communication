import { Patch, Scene, SceneObject, validatePatch } from "@intent/schema";
import { IntentError, ErrorCodes } from "./error.js";

/** Roots a `set`/`unset` path may target (trd 6.2). Anything else is E_BAD_REQUEST. */
const ALLOWED_PATH_ROOTS = new Set([
  "name",
  "visible",
  "size",
  "position",
  "margin",
  "style",
  "layout",
  "props",
  "a11y",
  "interactions",
  "responsive",
]);

/** Path segments that must never be traversed — they escape the object or reach Object.prototype. */
const FORBIDDEN_PATH_PARTS = new Set(["__proto__", "constructor", "prototype", "..", "."]);

function assertSafePatchPath(path: string, op: string): string[] {
  if (typeof path !== "string" || path.length === 0 || path.length > 512) {
    throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Patch path must be a non-empty string of at most 512 characters");
  }
  if (path.includes("/") || path.includes("\\")) {
    throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Patch path must not contain path separators");
  }
  if (path.includes("..")) {
    throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Patch path must not contain '..'");
  }

  const parts = path.split(".");
  for (const part of parts) {
    if (part.length === 0) {
      throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Patch path contains an empty segment");
    }
    if (FORBIDDEN_PATH_PARTS.has(part)) {
      throw new IntentError(ErrorCodes.E_BAD_REQUEST, `Patch path segment "${part}" is not allowed`);
    }
    if (part.length > 64 || !/^[A-Za-z0-9_$-]+$/.test(part)) {
      throw new IntentError(ErrorCodes.E_BAD_REQUEST, `Patch path segment "${part}" is not a valid identifier`);
    }
  }

  if (op === "set" || op === "unset") {
    const root = parts[0];
    if (root && !ALLOWED_PATH_ROOTS.has(root)) {
      throw new IntentError(
        ErrorCodes.E_BAD_REQUEST,
        `Patch path root "${root}" is forbidden for ${op}; allowed roots: ${[...ALLOWED_PATH_ROOTS].join(", ")}`
      );
    }
  }
  return parts;
}

export function applyPatch(scene: Scene, patch: Patch): Scene {
  const validated = validatePatch(patch);
  const objects = { ...scene.objects };
  const obj = objects[validated.objectId];
  if (!obj) {
    throw new IntentError(ErrorCodes.E_NOT_FOUND, `Object ${validated.objectId} not found`);
  }

  const pathParts = assertSafePatchPath(validated.path, validated.op);
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!part) continue;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = pathParts[pathParts.length - 1];
  if (!lastPart) return scene;

  switch (validated.op) {
    case "set":
      if (validated.value !== undefined) {
        current[lastPart] = validated.value;
      }
      break;
    case "unset":
      delete current[lastPart];
      break;
    case "add":
      if (Array.isArray(current[lastPart]) && validated.index !== undefined) {
        const arr = current[lastPart] as unknown[];
        arr.splice(validated.index, 0, validated.value);
      }
      break;
    case "remove":
      if (Array.isArray(current[lastPart]) && validated.index !== undefined) {
        const arr = current[lastPart] as unknown[];
        arr.splice(validated.index, 1);
      }
      break;
    case "move":
      if (validated.fromIndex !== undefined && validated.toParentId) {
        console.warn("Move operation not fully implemented");
      }
      break;
    case "setState":
      if (validated.value !== undefined) {
        current[lastPart] = validated.value;
      }
      break;
  }

  const newRevision = scene.revision + 1;
  const updatedObj = { ...obj, rev: newRevision, updatedAt: new Date().toISOString() };
  objects[validated.objectId] = updatedObj as SceneObject;

  return {
    ...scene,
    revision: newRevision,
    updatedAt: new Date().toISOString(),
    objects,
  };
}
