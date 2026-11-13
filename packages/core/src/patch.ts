import { Patch, Scene, SceneObject, validatePatch } from "@intent/schema";
import { IntentError, ErrorCodes } from "./error.js";

export function applyPatch(scene: Scene, patch: Patch): Scene {
  const validated = validatePatch(patch);
  const objects = { ...scene.objects };
  const obj = objects[validated.objectId];
  if (!obj) {
    throw new IntentError(ErrorCodes.E_NOT_FOUND, `Object ${validated.objectId} not found`);
  }

  const pathParts = validated.path.split(".").filter((p: string): p is string => Boolean(p));
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
