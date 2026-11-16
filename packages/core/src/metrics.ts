/**
 * Acceptance-rate metric (trd 17.2, PRD §9).
 *
 * Computed locally, on demand, never persisted. The baseline is the scene at
 * the `first-render` marker (first successful apply_patch), or if none exists,
 * the earliest version snapshot; if neither exists, the metric is `available:
 * false` with `reason: "no baseline"`.
 *
 * Definitions (trd 17.2):
 *   - Total                       = objects (not screens) in the final scene
 *   - baselineObjectsStillPresent = baseline objects still present in the final scene
 *   - unchanged                   = baselineObjectsStillPresent NOT touched by any applied patch
 *   - changed                     = baselineObjectsStillPresent - unchanged
 *   - addedAfterBaseline          = objects in the final scene whose id was NOT in baseline
 *   - removedAfterBaseline        = baseline objects missing from the final scene
 *   - acceptanceRate              = unchanged / baselineObjectsStillPresent
 */

export interface AppliedPatchRef {
  objectId: string | null;
  /** ISO timestamp of when the patch was applied (or created if unknown). */
  appliedAt?: string | null;
}

export interface AcceptanceMetricsInput {
  baselineObjects: Record<string, unknown>;
  currentObjects: Record<string, unknown>;
  /** Applied patches (objectId + appliedAt) after the baseline was captured. */
  appliedPatches?: AppliedPatchRef[];
}

export interface AcceptanceMetrics {
  available: boolean;
  reason?: string;
  total: number;
  baselineObjects: number;
  baselineObjectsStillPresent: number;
  unchanged: number;
  changed: number;
  addedAfterBaseline: number;
  removedAfterBaseline: number;
  acceptanceRate: number | null;
}

function objectIdsOf(objects: Record<string, unknown>): Set<string> {
  return new Set(Object.keys(objects));
}

export function computeAcceptanceRate(input: AcceptanceMetricsInput): AcceptanceMetrics {
  const { baselineObjects, currentObjects, appliedPatches = [] } = input;

  const baselineIds = objectIdsOf(baselineObjects);
  const currentIds = objectIdsOf(currentObjects);

  const baselineObjectsStillPresent = [...baselineIds].filter((id) => currentIds.has(id));
  const removedAfterBaseline = baselineIds.size - baselineObjectsStillPresent.length;
  const addedAfterBaseline = [...currentIds].filter((id) => !baselineIds.has(id)).length;

  const appliedIds = new Set(appliedPatches.map((p) => p.objectId).filter((id): id is string => typeof id === "string"));
  const unchanged = baselineObjectsStillPresent.filter((id) => !appliedIds.has(id)).length;
  const changed = baselineObjectsStillPresent.length - unchanged;

  const denominator = baselineObjectsStillPresent.length;
  if (denominator === 0) {
    return {
      available: false,
      reason: baselineIds.size === 0 ? "baseline had no objects" : "all baseline objects were removed",
      total: currentIds.size,
      baselineObjects: baselineIds.size,
      baselineObjectsStillPresent: 0,
      unchanged: 0,
      changed: 0,
      addedAfterBaseline,
      removedAfterBaseline,
      acceptanceRate: null,
    };
  }

  return {
    available: true,
    total: currentIds.size,
    baselineObjects: baselineIds.size,
    baselineObjectsStillPresent: denominator,
    unchanged,
    changed,
    addedAfterBaseline,
    removedAfterBaseline,
    acceptanceRate: unchanged / denominator,
  };
}
