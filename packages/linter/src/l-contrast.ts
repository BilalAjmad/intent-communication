/**
 * L-CONTRAST - Full WCAG Algorithm with Fix Hint Search (trd 7.2)
 */

export interface LContrastRule { name: 'L-CONTRAST' }

const AA_RATIO = 4.5
const AA_LARGE_RATIO = 3
const AAA_RATIO = 7
const AAA_LARGE_RATIO = 4.5

function parseColor(c: string): { r: number; g: number; b: number; a: number } {
  const h = c.startsWith('#') ? c.slice(1) : c
  if (h.length === 3) return { r: parseInt(h[0]+h[0],16)/255, g: parseInt(h[1]+h[1],16)/255, b: parseInt(h[2]+h[2],16)/255, a: 1 }
  if (h.length === 4) return { r: parseInt(h[0]+h[0],16)/255, g: parseInt(h[1]+h[1],16)/255, b: parseInt(h[2]+h[2],16)/255, a: parseInt(h[3]+h[3],16)/255 }
  if (h.length === 6) return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255, a: 1 }
  if (h.length === 8) return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255, a: parseInt(h.slice(6,8),16)/255 }
  throw new Error(`Invalid color: ${c}`)
}

function srgbToLinear(c: number): number { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
function lum(c: { r: number; g: number; b: number }): number {
  const r = c.r <= 0.03928 ? c.r / 12.92 : Math.pow((c.r + 0.055) / 1.055, 2.4)
  const g = c.g <= 0.03928 ? c.g / 12.92 : Math.pow((c.g + 0.055) / 1.055, 2.4)
  const b = c.b <= 0.03928 ? c.b / 12.92 : Math.pow((c.b + 0.055) / 1.055, 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isLargeText(fs: number, fw?: string): boolean {
  if (fs >= 18) return true
  if (fw === 'bold' && fs >= 14) return true
  return false
}

export function calculateContrast(fg: string, bg: string): number {
  const fgC = parseColor(fg), bgC = parseColor(bg)
  const cR = fg.r * fg.a + bg.r * (1 - fg.a), cG = fg.g * fg.a + bg.g * (1 - fg.a), cB = fg.b * fg.a + bg.b * (1 - fg.a)
  const cA = fg.a + bg.a * (1 - fg.a)
  if (cA === 0) return 1
  const fgL = luminance({ r: fg.r / cA, g: fg.g / cA, b: fg.b / cA })
  const bgL = luminance({ r: bg.r, g: bg.g, b: bg.b })
  const L = Math.max(fgL, bgL), D = Math.min(fgL, bgL)
  return (L + 0.05) / (D + 0.05)
}

function parseColor(c: string) {
  const h = c.startsWith('#') ? c.slice(1) : c
  if (h.length === 3) return { r: parseInt(h[0]+h[0],16)/255, g: parseInt(h[1]+h[1],16)/255, b: parseInt(h[2]+h[2],16)/255, a: 1 }
  if (h.length === 4) return { r: parseInt(h[0]+h[0],16)/255, g: parseInt(h[1]+h[1],16)/255, b: parseInt(h[2]+h[2],16)/255, a: parseInt(h[3]+h[3],16)/255 }
  if (h.length === 6) return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255, a: 1 }
  if (h.length === 8) return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255, a: parseInt(h.slice(6,8),16)/255 }
  throw new Error(`Invalid color: ${c}`)
}

function srgbToLinear(c: number): number { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
function luminance(c: { r: number; g: number; b: number }): number { return 0.2126 * (c.r <= 0.03928 ? c.r / 12.92 : Math.pow((c.r + 0.055) / 1.055, 2.4)) + 0.7152 * (c.g <= 0.03928 ? c.g / 12.92 : Math.pow((c.g + 0.055) / 1.055, 2.4)) + 0.0722 * (c.b <= 0.03928 ? c.b / 12.92 : Math.pow((c.b + 0.055) / 1.055, 2.4)) }
function isLargeText(fs: number, fw?: string): boolean { if (fs >= 18) return true; if (fw === 'bold' && fs >= 14) return true; return false }

export function lintContrast(scene: any): { errors: any[]; warnings: any[] } {
  const errors: any[] = [], warnings: any[] = []
  if (!scene.objects) return { errors, warnings }
  for (const obj of scene.objects) {
    if (obj.type !== 'text') continue
    const p = obj.props || {}, c = p.color, fs = p.fontSize, fw = p.fontWeight
    if (!c || typeof fs !== 'number') continue
    let bg = '#ffffffff', cur = obj
    while (cur && cur.parentId !== 'scene_root') {
      const par = cur.parentId ? scene.objects.find((o: any) => o.id === cur.parentId) : null
      if (par && par.props?.backgroundColor) { bg = par.props.backgroundColor; break }
      cur = par
    }
    const ratio = calculateContrast(p.color, bg)
    const large = isLargeText(p.fontSize, p.fontWeight)
    const reqAA = large ? 3 : 4.5, reqAAA = large ? 4.5 : 7
    if (ratio < (large ? 3 : 4.5)) {
      const fix = findContrastFix(p.color, bg, large ? 3 : 4.5)
      errors.push({ code: large ? 'L-CONTRAST-AA-LARGE' : 'L-CONTRAST-AA', message: `Contrast ${ratio.toFixed(2)}:1 fails AA ${large ? '(large: 3:1)' : '(4.5:1)'}`, objectId: obj.id, fixHint: fix ? `Try ${fix}` : 'Adjust color' })
    } else if (ratio < (large ? 4.5 : 7)) {
      warnings.push({ code: 'L-CONTRAST-AAA', message: `Contrast ${ratio.toFixed(2)}:1 fails AAA`, objectId: obj.id })
    }
  }
  return { errors, warnings: [] }
}

function isLargeText(fs: number, fw?: string): boolean { if (fs >= 18) return true; if (fw === 'bold' && fs >= 14) return true; return false }
export function calculateContrast(fg: string, bg: string): number {
  const fgC = parseColor(fg), bgC = parseColor(bg)
  const cR = fg.r * fg.a + bg.r * (1 - fg.a), cG = fg.g * fg.a + bg.g * (1 - fg.a), cB = fg.b * fg.a + bg.b * (1 - fg.a)
  const cA = fg.a + bg.a * (1 - fg.a); if (cA === 0) return 1
  const fgL = luminance({ r: fg.r / cA, g: fg.g / cA, b: fg.b / cA })
  const bgL = luminance({ r: bg.r, g: bg.g, b: bg.b })
  const L = Math.max(fgL, bgL), D = Math.min(fgL, bgL)
  return (L + 0.05) / (D + 0.05)
}