import { Patch, Scene, SceneObject, validatePatch } from "@intent/schema";
import { IntentError, ErrorCodes } from "./error.js";

/** Roots a `set`/`unset`/`setState` path may target (trd 6.2 + what the Scene schema
 *  actually persists). Anything else is E_BAD_REQUEST. */
const ALLOWED_PATH_ROOTS = new Set([
  "props",
  "style",
  "meta",
]);

/** `setState` additionally may address the object's states record — the op
 *  exists for exactly that. The second segment must be a well-formed state name. */
const STATE_NAME = /^[a-z][a-z0-9-]{0,31}$/;
/** The schema's closed state-name enum (base-object.ts STATE_NAMES) — patches may
 *  only create states the scene model actually knows how to render. */
const VALID_STATE_NAMES = new Set([
  "hover", "pressed", "focus", "disabled", "visited", "checked", "filled",
  "loading", "error", "empty", "open", "success", "submitting", "content",
]);

/** `add`/`remove`/`move` may only touch arrays under the same safe roots —
 *  the object's `children` subtree stays unreachable from patches so tree
 *  integrity (parentId/children agreement) cannot be corrupted from here. */
const ALLOWED_ARRAY_ROOTS = ALLOWED_PATH_ROOTS;

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

  if (op === "set" || op === "unset" || op === "setState") {
    const root = parts[0];
    if (root && !ALLOWED_PATH_ROOTS.has(root)) {
      // setState may additionally address the object's states record.
      if (op === "setState" && root === "states") {
        const stateName = parts[1];
        if (!stateName || !STATE_NAME.test(stateName)) {
          throw new IntentError(ErrorCodes.E_BAD_REQUEST, "setState path must be states.<state-name>.… with a lowercase state name");
        }
        if (!VALID_STATE_NAMES.has(stateName)) {
          throw new IntentError(ErrorCodes.E_BAD_REQUEST, `Unknown state name "${stateName}" — states must be one of the schema's names`);
        }
      } else {
        throw new IntentError(
          ErrorCodes.E_BAD_REQUEST,
          `Patch path root "${root}" is forbidden for ${op}; allowed roots: ${[...ALLOWED_PATH_ROOTS].join(", ")}${op === "setState" ? ", states" : ""}`
        );
      }
    }
  }
  if (op === "add" || op === "remove" || op === "move") {
    const root = parts[0];
    if (root && !ALLOWED_ARRAY_ROOTS.has(root)) {
      throw new IntentError(
        ErrorCodes.E_BAD_REQUEST,
        `Patch path root "${root}" is forbidden for ${op}; allowed roots: ${[...ALLOWED_ARRAY_ROOTS].join(", ")}`
      );
    }
  }
  return parts;
}

export function applyPatch(scene: Scene, patch: Patch): Scene {
  const validated = validatePatch(patch);
  const objects = { ...scene.objects };
  const rawObj = objects[validated.objectId];
  if (!rawObj) {
    throw new IntentError(ErrorCodes.E_NOT_FOUND, `Object ${validated.objectId} not found — apply_patch can only modify existing objects. Create objects in the Studio first, then modify them here.`);
  }
  // Deep-clone the target object: applyPatch must not mutate the caller's scene.
  const obj = structuredClone(rawObj);

  const pathParts = assertSafePatchPath(validated.path, validated.op);
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!part) continue;
    if (!Object.hasOwn(current, part)) {
      current[part] = {};
    } else if (typeof current[part] !== "object" || current[part] === null) {
      throw new IntentError(
        ErrorCodes.E_BAD_REQUEST,
        `Patch path segment "${part}" does not resolve to an object`
      );
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = pathParts[pathParts.length - 1];
  if (!lastPart) return scene;

  switch (validated.op) {
    case "set":
      if (validated.value === undefined) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "op 'set' requires a value");
      }
      current[lastPart] = validated.value;
      break;
    case "unset":
      delete current[lastPart];
      break;
    case "add": {
      if (validated.value === undefined) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "op 'add' requires a value");
      }
      if (validated.index === undefined) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "op 'add' requires an index");
      }
      if (!Array.isArray(current[lastPart])) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "op 'add' target is not an array");
      }
      const addTarget = current[lastPart] as unknown[];
      if (validated.index > addTarget.length) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, `op 'add' index ${validated.index} exceeds array length ${addTarget.length}`);
      }
      addTarget.splice(validated.index, 0, validated.value);
      break;
    }
    case "remove": {
      if (validated.index === undefined) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "op 'remove' requires an index");
      }
      if (!Array.isArray(current[lastPart])) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "op 'remove' target is not an array");
      }
      const removeTarget = current[lastPart] as unknown[];
      if (validated.index >= removeTarget.length) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, `op 'remove' index ${validated.index} is out of bounds for array length ${removeTarget.length}`);
      }
      removeTarget.splice(validated.index, 1);
      break;
    }
    case "move":
      // Not implemented in M1 — fail loudly instead of pretending to succeed.
      throw new IntentError(ErrorCodes.E_BAD_REQUEST, "op 'move' is not implemented in M1");
    case "setState":
      if (validated.value === undefined) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "op 'setState' requires a value");
      }
      current[lastPart] = validated.value;
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
