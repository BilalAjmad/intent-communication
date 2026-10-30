/**
 * L-GRID - Grid Alignment (trd 7.2)
 * 4px grid required, 8px recommended (warn).
 */

export interface LGridRule {
  name: 'L-GRID'
}

const GRID_SIZE = 4
const RECOMMENDED_GRID = 8

export function lintGrid(scene: any): { errors: any[]; warnings: any[] } {
  const errors: any[] = []
  const warnings: any[] = []

  if (!scene.objects) return { errors, warnings }

  for (const obj of scene.objects) {
    const rect = obj.rect
    if (!rect) continue

    // Check 4px grid alignment (errors)
    if (rect.x % GRID_SIZE !== 0) {
      errors.push({ code: 'L-GRID-X', message: `Object x=${rect.x} not aligned to ${GRID_SIZE}px grid`, objectId: obj.id, fixHint: `Adjust x to nearest multiple of ${GRID_SIZE}` })
    }
    if (rect.y % GRID_SIZE !== 0) {
      errors.push({ code: 'L-GRID-Y', message: `Object y=${rect.y} not aligned to ${GRID_SIZE}px grid`, objectId: obj.id, fixHint: `Adjust y to nearest multiple of ${GRID_SIZE}` })
    }
    if (rect.width % GRID_SIZE !== 0) {
      errors.push({ code: 'L-GRID-WIDTH', message: `Object width=${rect.width} not aligned to ${GRID_SIZE}px grid`, objectId: obj.id, fixHint: `Adjust width to nearest multiple of ${GRID_SIZE}` })
    }
    if (rect.height % GRID_SIZE !== 0) {
      errors.push({ code: 'L-GRID-HEIGHT', message: `Object height=${rect.height} not aligned to ${GRID_SIZE}px grid`, objectId: obj.id, fixHint: `Adjust height to nearest multiple of ${GRID_SIZE}` })
    }

    // Check 8px recommended grid (warnings)
    const onRecommendedGrid = rect.x % RECOMMENDED_GRID === 0 && rect.y % RECOMMENDED_GRID === 0 && rect.width % RECOMMENDED_GRID === 0 && rect.height % RECOMMENDED_GRID === 0
    if (!onRecommendedGrid && rect.x % GRID_SIZE === 0 && rect.y % GRID_SIZE === 0 && rect.width % GRID_SIZE === 0 && rect.height % GRID_SIZE === 0) {
      warnings.push({ code: 'L-GRID-WARN-8PX', message: `Object aligned to ${GRID_SIZE}px but not ${RECOMMENDED_GRID}px recommended grid`, objectId: obj.id, fixHint: `Consider aligning to ${RECOMMENDED_GRID}px grid for better consistency` })
    }
  }

  return { errors, warnings: [] }
}