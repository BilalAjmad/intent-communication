import { Scene, Patch, validateScene } from "@intent/schema";

export function normalizeScene(input: unknown): { scene: Scene; patches: Patch[] } {
  const scene = validateScene(input);
  const patches: Patch[] = [];
  return { scene, patches };
}
