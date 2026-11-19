import type { Scene } from "@intent/schema";

/**
 * Ids reachable from any screen's root (inclusive). Component-definition
 * source nodes exist in scene.objects but are unreachable by construction —
 * emitting CSS selectors for them ships dead rules in every export.
 */
export function reachableObjectIds(scene: Scene): Set<string> {
  const objects = scene.objects ?? {};
  const out = new Set<string>();
  const stack: string[] = [];
  // Screens live in scene.screens, NOT scene.objects — walk the objects graph
  // from each screen's children.
  for (const screenId of Object.keys(scene.screens ?? {})) {
    const screen = (scene.screens as Record<string, { id?: unknown; children?: unknown } | undefined>)[screenId];
    if (typeof screen?.id === "string") out.add(screen.id);
    if (screen && Array.isArray(screen.children)) {
      for (const child of screen.children) {
        if (typeof child === "string") stack.push(child);
      }
    }
  }
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const obj = objects[id];
    if (obj && Array.isArray(obj.children)) {
      for (const child of obj.children) stack.push(child);
    }
  }
  return out;
}
