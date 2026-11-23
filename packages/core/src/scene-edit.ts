import { randomBytes } from "node:crypto";
import {
  CreateObjectInput,
  DeleteObjectInput,
  Scene,
  SceneObject,
  SceneObjectSchema,
  SceneSchema,
  Screen,
} from "@intent/schema";
import { IntentError, ErrorCodes } from "./error.js";

/**
 * Scene editing that `apply_patch` intentionally does not do: creating the
 * first screen/object and deleting a subtree.
 *
 * `apply_patch` is object-scoped (one objectId, safe roots only) — that is the
 * correct security boundary for edits. But a freshly initialized project has
 * an empty scene, so without a create path no agent could ever build anything.
 * These two functions own creation/deletion; every payload still goes through
 * the same Scene schema before it is written, and the resulting scene is
 * re-validated as a whole so referential mistakes fail loudly.
 */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Crockford base32 ULID: 10 time chars (48-bit ms) + 16 random chars. */
function crockfordUlid(): string {
  let out = "";
  let t = Date.now();
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[t % 32] + out;
    t = Math.floor(t / 32);
  }
  const bytes = randomBytes(16);
  for (let i = 0; i < 16; i++) out += CROCKFORD[(bytes[i] as number) % 32];
  return out;
}

export function newObjectId(type: string): string {
  return `${type === "screen" ? "s" : "o"}_${crockfordUlid()}`;
}

/** Parents that can own children. Screens are handled separately. */
const CONTAINER_TYPES = new Set(["container", "modal"]);
const MAX_DEPTH = 64;

function badRequest(message: string): never {
  throw new IntentError(ErrorCodes.E_BAD_REQUEST, message);
}

function notFound(message: string): never {
  throw new IntentError(ErrorCodes.E_NOT_FOUND, message);
}

function parseObject(candidate: unknown): SceneObject {
  try {
    return SceneObjectSchema.parse(candidate) as SceneObject;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new IntentError(ErrorCodes.E_SCHEMA, `Object payload is not a valid scene object: ${message}`);
  }
}

function depthOf(scene: Scene, parentId: string): number {
  let depth = 1;
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) badRequest("Scene contains a parent cycle");
    seen.add(cursor);
    const node: SceneObject | Screen | undefined = scene.screens[cursor] ?? scene.objects[cursor];
    cursor = node?.parentId ?? null;
    depth += 1;
    if (depth > MAX_DEPTH) badRequest(`Object nesting exceeds ${MAX_DEPTH} levels`);
  }
  return depth;
}

export interface CreateObjectResult {
  scene: Scene;
  objectId: string;
  object: SceneObject;
}

export function createObject(scene: Scene, input: CreateObjectInput, now: string): CreateObjectResult {
  const isScreen = input.type === "screen";
  const objectId = input.id ?? newObjectId(input.type);

  if (scene.screens[objectId] || scene.objects[objectId]) {
    badRequest(`Object ${objectId} already exists`);
  }
  if (isScreen) {
    if (!objectId.startsWith("s_")) badRequest("A screen id must start with s_");
    if (input.parentId != null) badRequest("A screen cannot have a parent");
  } else {
    if (!objectId.startsWith("o_")) badRequest("A non-screen object id must start with o_");
    if (!input.parentId) badRequest(`parentId is required when creating a ${input.type}`);
  }

  const parentId = isScreen ? null : (input.parentId as string);
  const candidate = {
    id: objectId,
    type: input.type,
    parentId,
    children: [],
    props: input.props ?? {},
    style: input.style ?? {},
    meta: input.meta ?? {},
    rev: scene.revision + 1,
    updatedAt: now,
  };
  const parsed = parseObject(candidate);

  const screens: Record<string, Screen> = { ...scene.screens };
  const objects: Record<string, SceneObject> = { ...scene.objects };
  let screenOrder = [...scene.screenOrder];

  if (isScreen) {
    screens[objectId] = parsed as Screen;
    const at = input.index === undefined ? screenOrder.length : Math.min(input.index, screenOrder.length);
    screenOrder = [...screenOrder.slice(0, at), objectId, ...screenOrder.slice(at)];
  } else {
    const parentIsScreen = Boolean(scene.screens[parentId as string]);
    const parent = parentIsScreen ? scene.screens[parentId as string] : scene.objects[parentId as string];
    if (!parent) notFound(`Parent ${parentId} not found`);
    if (!(parent.type === "screen" || CONTAINER_TYPES.has(parent.type))) {
      badRequest(`Object type "${parent.type}" cannot contain children (use a screen, container, or modal)`);
    }
    depthOf(scene, parentId as string);

    objects[objectId] = parsed;
    const children = [...parent.children];
    const at = input.index === undefined ? children.length : Math.min(input.index, children.length);
    children.splice(at, 0, objectId);
    const updatedParent = { ...parent, children, rev: scene.revision + 1, updatedAt: now };
    if (parentIsScreen) screens[parentId as string] = updatedParent as Screen;
    else objects[parentId as string] = updatedParent as SceneObject;
  }

  const next: Scene = {
    ...scene,
    revision: scene.revision + 1,
    updatedAt: now,
    screens,
    objects,
    screenOrder,
  };
  return { scene: validateScene(next), objectId, object: parsed };
}

export interface DeleteObjectResult {
  scene: Scene;
  removed: string[];
}

export function deleteObject(scene: Scene, input: DeleteObjectInput, now: string): DeleteObjectResult {
  const isScreen = Boolean(scene.screens[input.objectId]);
  const target = isScreen ? scene.screens[input.objectId] : scene.objects[input.objectId];
  if (!target) notFound(`Object ${input.objectId} not found`);

  const screens: Record<string, Screen> = { ...scene.screens };
  const objects: Record<string, SceneObject> = { ...scene.objects };
  const removed: string[] = [];

  const collect = (rootIds: string[]) => {
    const stack = [...rootIds];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      const node: SceneObject | Screen | undefined = objects[id] ?? screens[id];
      if (!node) continue;
      removed.push(id);
      stack.push(...node.children);
    }
  };

  if (isScreen) {
    collect(target.children);
    for (const id of removed) delete objects[id];
    removed.unshift(input.objectId);
    delete screens[input.objectId];
  } else {
    collect([input.objectId]);
    for (const id of removed) {
      delete objects[id];
      delete screens[id];
    }
    const parentId = target.parentId;
    if (parentId) {
      const parent = screens[parentId] ?? objects[parentId];
      if (parent) {
        const children = parent.children.filter((id) => id !== input.objectId);
        const updatedParent = { ...parent, children, rev: scene.revision + 1, updatedAt: now };
        if (screens[parentId]) screens[parentId] = updatedParent as Screen;
        else objects[parentId] = updatedParent as SceneObject;
      }
    }
  }

  const next: Scene = {
    ...scene,
    revision: scene.revision + 1,
    updatedAt: now,
    screens,
    objects,
    screenOrder: scene.screenOrder.filter((id) => id !== input.objectId),
  };
  return { scene: validateScene(next), removed };
}

function validateScene(scene: Scene): Scene {
  try {
    return SceneSchema.parse(scene);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new IntentError(ErrorCodes.E_SCHEMA, `Resulting scene is invalid: ${message}`);
  }
}
