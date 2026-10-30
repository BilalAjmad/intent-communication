/**
 * L-TOUCH - Touch Target Sizing (trd 7.2)
 * Minimum 44x44 for interactive elements.
 */

export interface LTouchRule { name: 'L-TOUCH' }

const MIN_TOUCH_SIZE = 44

export function lintTouch(scene: any): { errors: any[]; warnings: any[] } {
  const errors: any[] = []
  const warnings: any[] = []

  if (!scene.objects) return { errors, warnings }

  for (const obj of scene.objects) {
    const props = obj.props || {}
    const role = props.role

    // Check interactive elements
    const isInteractive = role === 'button' || role === 'link' || role === 'menuitem' || role === 'tab' || role === 'checkbox' || role === 'radio' || role === 'slider'

    if (!isInteractive) continue

    const rect = obj.rect
    if (!rect) continue

    if (rect.width < MIN_TOUCH_SIZE) {
      errors.push({ code: 'L-TOUCH-WIDTH', message: `Interactive element width ${rect.width}px < ${MIN_TOUCH_SIZE}px`, objectId: obj.id, fixHint: `Increase width to at least ${MIN_TOUCH_SIZE}px` })
    }
    if (rect.height < MIN_TOUCH_SIZE) {
      errors.push({ code: 'L-TOUCH-HEIGHT', message: `Interactive element height ${rect.height}px < ${MIN_TOUCH_SIZE}px`, objectId: obj.id, fixHint: `Increase height to at least ${MIN_TOUCH_SIZE}px` })
    }
  }

  return { errors, warnings: [] }
}