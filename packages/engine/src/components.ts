import type { Scene, SceneObject, ComponentDef, ComponentRef, Responsive } from "@intent/schema";
import { IntentError, ErrorCodes } from "@intent/core";

/**
 * trd 5.5 Component expansion.
 *
 * Instance objects carry `componentRef`. Expansion is a RENDER-TIME operation:
 * the stored scene keeps instances compact (derived ids like
 * `<instanceId>::<innerId>` would not pass ObjectIdSchema if persisted).
 *
 * Pure and deterministic: same input → same output, no clock, no randomness.
 * The input scene is not mutated.
 *
 * Semantics:
 *  - the def ROOT maps onto the instance object itself (same id);
 *  - every other def node is cloned with id `<instanceId>::<innerId>`;
 *    nested instances nest ids naturally (`A::N::x`);
 *  - def props/style/states/responsive are the BASE; the instance's own
 *    keys win per key (so an empty instance inherits the def entirely);
 *  - `componentRef.overrides[innerId]` wins last ("edit this one instance");
 *  - unknown override keys are rejected with E_SCHEMA (mistyping inner ids
 *    must fail loudly, never silently no-op);
 *  - `visible: false` in an override emits display:none on the target node
 *    (non-destructive; the def keeps its own visibility);
 *  - nesting of instances inside defs is supported up to MAX_DEPTH.
 */

const MAX_DEPTH = 8;
const MAX_CLONES = 5000;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function preOrder(rootId: string, objects: Record<string, SceneObject>): string[] {
  const order: string[] = [];
  const inStack = new Set<string>();
  const walk = (id: string): void => {
    const obj = objects[id];
    if (!obj) return;
    if (inStack.has(id)) {
      throw new IntentError(ErrorCodes.E_LIMIT, `Component definition contains a cycle at object ${id}`);
    }
    order.push(id);
    inStack.add(id);
    for (const child of obj.children) {
      walk(child);
    }
    inStack.delete(id);
  };
  walk(rootId);
  return order;
}

function mergeResponsive(base: Responsive | undefined, override: Responsive | undefined): Responsive {
  const merged: Responsive = { ...base };
  for (const key of ["sm", "md", "lg"] as const) {
    const b = merged[key];
    const o = override?.[key];
    if (b || o) {
      merged[key] = {
        ...b,
        ...o,
        style: { ...(b?.style ?? {}), ...(o?.style ?? {}) },
        layout: { ...(b?.layout ?? {}), ...(o?.layout ?? {}) },
        size: { ...(b?.size ?? {}), ...(o?.size ?? {}) },
        position: { ...(b?.position ?? {}), ...(o?.position ?? {}) },
      };
    }
  }
  return merged;
}

function applyOverride(
  obj: SceneObject,
  override: { props?: Record<string, SceneObject["props"][string]>; style?: Record<string, SceneObject["style"][string]>; visible?: boolean },
): void {
  if (override.props) obj.props = { ...obj.props, ...override.props } as SceneObject["props"];
  if (override.style) obj.style = { ...obj.style, ...override.style } as SceneObject["style"];
  if (override.visible === false) {
    obj.style = { ...obj.style, display: "none" } as SceneObject["style"];
  }
}

function resolveDef(defs: Map<string, ComponentDef>, componentId: string, instanceId: string): ComponentDef {
  const def = defs.get(componentId);
  if (!def) {
    throw new IntentError(ErrorCodes.E_SCHEMA, `Instance ${instanceId} references missing component ${componentId}`);
  }
  return def;
}

function checkDefObjectIds(def: ComponentDef, objects: Record<string, SceneObject>): void {
  for (const id of def.objectIds) {
    if (!objects[id]) {
      throw new IntentError(
        ErrorCodes.E_SCHEMA,
        `Component ${def.id} declares object ${id} but it is missing from the scene`,
      );
    }
  }
  if (!objects[def.rootId]) {
    throw new IntentError(ErrorCodes.E_SCHEMA, `Component ${def.id} root ${def.rootId} is missing`);
  }
  if (!def.objectIds.includes(def.rootId)) {
    throw new IntentError(
      ErrorCodes.E_SCHEMA,
      `Component ${def.id} root ${def.rootId} is not listed in objectIds`,
    );
  }
}

/**
 * Expand the instance at `instanceId` in place (objects map is scratch,
 * already detached from the input scene). Depth-first; nested instances
 * recursively expand with nested ids.
 */
function expandInstanceRecursive(
  instanceId: string,
  inst: SceneObject,
  ref: ComponentRef,
  def: ComponentDef,
  objects: Record<string, SceneObject>,
  defs: Map<string, ComponentDef>,
  depth: number,
  budget: { remaining: number },
): void {
  if (depth > MAX_DEPTH) {
    throw new IntentError(ErrorCodes.E_LIMIT, `Component instance nesting exceeds ${MAX_DEPTH} levels`);
  }
  checkDefObjectIds(def, objects);

  const order = preOrder(def.rootId, objects);
  const derivedOf = new Map<string, string>();
  for (const innerId of order) {
    derivedOf.set(innerId, innerId === def.rootId ? instanceId : `${instanceId}::${innerId}`);
  }

  // innerId -> materialized object (plain clone or nested-instance shell)
  const materialized = new Map<string, SceneObject>();

  for (const innerId of order) {
    const innerObjMaybe = objects[innerId];
    if (!innerObjMaybe) {
      throw new IntentError(ErrorCodes.E_SCHEMA, `Component subtree object ${innerId} is missing`);
    }
    const innerObj = innerObjMaybe;
    const derivedId = derivedOf.get(innerId)!;
    if (budget.remaining <= 0) {
      throw new IntentError(ErrorCodes.E_LIMIT, "Component expansion exceeds the node budget");
    }

    if (innerObj.componentRef) {
      // Nested instance: give it a shell with its derived id and recurse.
      const nestedDef = resolveDef(defs, innerObj.componentRef.componentId, derivedId);
      const shell = deepClone(innerObj);
      shell.id = derivedId;
      shell.parentId = innerId === def.rootId ? inst.parentId : (derivedOf.get(innerObj.parentId ?? "") ?? instanceId);
      objects[derivedId] = shell;
      materialized.set(innerId, shell);
      budget.remaining -= 1;
      expandInstanceRecursive(derivedId, shell, innerObj.componentRef, nestedDef, objects, defs, depth + 1, budget);
      continue;
    }

    const clone = deepClone(innerObj);
    clone.id = derivedId;
    clone.parentId = innerId === def.rootId ? inst.parentId : (derivedOf.get(innerObj.parentId ?? "") ?? instanceId);
    materialized.set(innerId, clone);
    budget.remaining -= 1;
  }

  for (const clone of materialized.values()) {
    clone.children = clone.children.map((child) => derivedOf.get(child) ?? child);
  }

  // The instance node becomes the expanded def root (same id): base from the
  // def root, instance keys win, and the def-root override wins last.
  const rootClone = materialized.get(def.rootId)!;
  const refOverrides = ref.overrides ?? {};
  const rootOverride = refOverrides[def.rootId];
  for (const innerId of Object.keys(refOverrides)) {
    if (innerId !== def.rootId && !derivedOf.has(innerId)) {
      throw new IntentError(
        ErrorCodes.E_SCHEMA,
        `componentRef override for ${instanceId} references unknown inner node ${innerId}`,
      );
    }
  }
  inst.props = { ...rootClone.props, ...inst.props, ...(rootOverride?.props ?? {}) } as SceneObject["props"];
  inst.style = { ...rootClone.style, ...inst.style, ...(rootOverride?.style ?? {}) } as SceneObject["style"];
  inst.states = { ...rootClone.states, ...inst.states } as SceneObject["states"];
  inst.responsive = mergeResponsive(rootClone.responsive, inst.responsive);
  if (rootOverride?.visible === false) {
    inst.style = { ...inst.style, display: "none" } as SceneObject["style"];
  }
  inst.children = rootClone.children;

  for (const [innerId, node] of materialized) {
    if (innerId === def.rootId) continue;
    objects[node.id] = node;
  }

  for (const [innerId, override] of Object.entries(refOverrides)) {
    if (!override) continue;
    if (innerId === def.rootId) continue; // already applied to the instance above
    const target = materialized.get(innerId);
    if (!target) {
      throw new IntentError(
        ErrorCodes.E_SCHEMA,
        `componentRef override for ${instanceId} references unknown inner node ${innerId}`,
      );
    }
    applyOverride(target, override);
  }
}

/** Expands all instances in a scene. The input scene object is not mutated. */
export function expandComponentInstances(scene: Scene): Scene {
  const components = scene.components ?? [];
  const hasInstances = Object.values(scene.objects).some((obj) => obj?.componentRef);
  if (components.length === 0) {
    if (hasInstances) {
      const first = Object.values(scene.objects).find((obj) => obj?.componentRef);
      const label = first ? first.id : "(unknown)";
      throw new IntentError(
        ErrorCodes.E_SCHEMA,
        `Instance ${label} references a component but the scene declares none`,
      );
    }
    return scene;
  }
  if (!hasInstances) return scene;

  const defs = new Map(components.map((d) => [d.id, d] as const));
  const objects: Record<string, SceneObject> = { ...scene.objects };
  const budget = { remaining: MAX_CLONES };

  const instanceIds = Object.keys(objects).filter((id) => objects[id]?.componentRef).sort();
  for (const instanceId of instanceIds) {
    const current = objects[instanceId];
    if (!current) continue; // unreachable: ids come from the same map
    // Detach the instance from the input scene before expansion mutates it.
    objects[instanceId] = deepClone(current);
    const ref = objects[instanceId].componentRef!;
    const def = resolveDef(defs, ref.componentId, instanceId);
    expandInstanceRecursive(instanceId, objects[instanceId], ref, def, objects, defs, 0, budget);
  }

  return { ...scene, objects };
}
