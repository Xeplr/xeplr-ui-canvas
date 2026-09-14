// Free-canvas geometry — where an item is, and what moving or resizing one
// does. Pure, so the arithmetic that actually goes wrong is testable without
// a mouse. No React, no DOM.
//
// Moved here from the BI dashboard builder so every canvas — dashboard,
// workflow, dataset joins, the UI creator — lands on the same rules.
//
// Free placement rather than a snap grid WAS a deliberate choice: a board is
// composed, not filled. The cost is that "roughly aligned" is the natural
// result of dragging, and a board of nearly-aligned edges looks broken in a
// way a grid never does.
//
// BOTH NOW, and in that order. The grid came back because composing a unit out
// of five items needs consistent widths and gaps, which free placement makes
// you achieve by eye every time. It is the FALLBACK though: alignment snapping
// is tried first and wins, because lining up with the box beside you is a
// stronger intent than landing on a round number. See GRID below.
//
// So the canvas offers ALIGNMENT SNAPPING first — while you drag, an edge or
// centre that comes within a few pixels of another item's edge or centre
// jumps to it exactly, and the guide is drawn so you can see why it moved.

// ── FRACTIONAL geometry ───────────────────────────────────────────────
//
// An item may store where it sits as a FRACTION of the canvas (0..1) rather
// than as pixels (units: 'fraction'). A board laid out on a 27-inch screen
// then still reads on a laptop.
//
// The two axes are NOT the same fraction, and the difference is the point.
//
//   x and w  are a fraction of the canvas WIDTH — so a board laid out wide
//            still reads narrow, and nothing hangs off the right edge.
//   y and h  are a fraction of a PAGE, where one page is the visible height.
//            y may exceed 1: 1.5 is half a page below the fold.
//
// Horizontal space is fixed by the window and vertical space is not — you
// scroll down, you do not scroll sideways.
//
// Dragging still works in PIXELS, because a mouse does. The conversion
// happens once, when the position is committed.

// An item's floor.
//
// What the floor is for is keeping an item SELECTABLE — a box you cannot get
// hold of cannot be resized back, or deleted. So it is set to the smallest
// thing you can still reliably grab, and no larger. A caller with smaller
// things (a one-pixel rule) passes its own via minSizeFor.
export const MIN_WIDTH = 48
export const MIN_HEIGHT = 28

/** How close an edge has to come before it snaps. */
export const SNAP_TOLERANCE = 6

/**
 * The background grid, in px. A canvas that draws a grid should draw it at
 * this spacing, so what you see and what you land on are the same.
 *
 * ALIGNMENT SNAPPING STILL WINS. The grid is the fallback for an axis that hit
 * nothing: a grid that overrode alignment would pull an item off the edge it
 * was just aligned to.
 */
export const GRID = 10
export const DEFAULT_SIZE = { w: 420, h: 300 }

/** The eight handles, as [x, y] multipliers of the box's size. */
export const RESIZE_HANDLES = [
  { key: 'nw', x: 0, y: 0 }, { key: 'n', x: 0.5, y: 0 }, { key: 'ne', x: 1, y: 0 },
  { key: 'w', x: 0, y: 0.5 }, { key: 'e', x: 1, y: 0.5 },
  { key: 'sw', x: 0, y: 1 }, { key: 's', x: 0.5, y: 1 }, { key: 'se', x: 1, y: 1 }
]

/** A pixel item's rect, with defaults for anything unset. */
export function rectOf(item) {
  return { x: item.x || 0, y: item.y || 0, w: item.w || DEFAULT_SIZE.w, h: item.h || DEFAULT_SIZE.h }
}

/**
 * An item's rect in PIXELS whatever it is stored in — the one conversion the
 * drag, the marquee and the edges all need.
 *
 * A fraction item with no measured canvas yet falls back to its raw values:
 * the same thing the dashboard always did before its canvas was measured.
 */
export function pixelRect(item, units, canvas) {
  return units === 'fraction' && canvas ? toPixels(item, canvas) : rectOf(item)
}

/** The lines a rect can snap to: both edges and the centre, per axis. */
function linesOf(rect) {
  return {
    x: [rect.x, rect.x + rect.w / 2, rect.x + rect.w],
    y: [rect.y, rect.y + rect.h / 2, rect.y + rect.h]
  }
}

/**
 * The nearest snap for one axis.
 *
 * `candidates` are the moving rect's own lines — so a right edge snapping to
 * another item's left edge moves the whole box, not just that edge.
 *
 * @returns {{ delta, line }|null} delta — add to the origin; line — where to
 *          draw the guide
 */
function nearestSnap(candidates, targets, tolerance) {
  let best = null
  for (const c of candidates) {
    for (const t of targets) {
      const distance = Math.abs(c.at - t)
      if (distance > tolerance) continue
      if (!best || distance < best.distance) best = { distance, delta: t - c.at, line: t }
    }
  }
  return best ? { delta: best.delta, line: best.line } : null
}

/**
 * Moves a rect to (x, y), snapping to the others.
 *
 * @param others  the rects to snap against — every item except this one
 * @returns {{ x, y, guides }} guides — [{ axis, at }] for the ones that hit
 */
export function moveRect(rect, x, y, others, opts) {
  const tolerance = opts?.tolerance ?? SNAP_TOLERANCE
  // Held down, snapping is off: the point of a free canvas is that you can
  // always overrule it.
  const free = Boolean(opts?.disableSnap)
  const moved = { x, y, w: rect.w, h: rect.h }
  const guides = []

  if (!free && others.length) {
    const targets = others.map(linesOf)
    const targetX = targets.flatMap((t) => t.x)
    const targetY = targets.flatMap((t) => t.y)

    const snapX = nearestSnap(
      [{ at: moved.x }, { at: moved.x + moved.w / 2 }, { at: moved.x + moved.w }], targetX, tolerance)
    const snapY = nearestSnap(
      [{ at: moved.y }, { at: moved.y + moved.h / 2 }, { at: moved.y + moved.h }], targetY, tolerance)

    if (snapX) { moved.x += snapX.delta; guides.push({ axis: 'x', at: snapX.line }) }
    if (snapY) { moved.y += snapY.delta; guides.push({ axis: 'y', at: snapY.line }) }

    // Only where nothing better was found — see GRID.
    const grid = opts?.grid ?? GRID
    if (grid > 0) {
      if (!snapX) moved.x = Math.round(moved.x / grid) * grid
      if (!snapY) moved.y = Math.round(moved.y / grid) * grid
    }
  }

  // Negative coordinates put an item where no scrollbar can reach it.
  return { x: Math.max(0, Math.round(moved.x)), y: Math.max(0, Math.round(moved.y)), guides }
}

/**
 * Resizes from one handle, keeping the opposite edge fixed.
 *
 * Below the minimum the box stops growing INWARD rather than flipping: a box
 * dragged past its own opposite edge would otherwise invert, and a negative
 * width is not a shape anything can render.
 */
export function resizeRect(rect, handle, dx, dy, opts) {
  const min = { w: opts?.minWidth ?? MIN_WIDTH, h: opts?.minHeight ?? MIN_HEIGHT }
  const h = RESIZE_HANDLES.find((k) => k.key === handle)
  if (!h) return { ...rect }

  let { x, y, w, hgt } = { x: rect.x, y: rect.y, w: rect.w, hgt: rect.h }

  if (h.x === 0) {           // dragging the left edge: the right stays put
    const right = x + w
    x = Math.min(x + dx, right - min.w)
    w = right - x
  } else if (h.x === 1) {
    w = Math.max(min.w, w + dx)
  }

  if (h.y === 0) {           // dragging the top edge: the bottom stays put
    const bottom = y + hgt
    y = Math.min(y + dy, bottom - min.h)
    hgt = bottom - y
  } else if (h.y === 1) {
    hgt = Math.max(min.h, hgt + dy)
  }

  // SNAPPING WHILE RESIZING, and only on the edges actually being dragged.
  //
  // A resize holds one edge still by definition — grabbing the right handle
  // must never shift the left — so only the moving edge is offered as a
  // candidate. Snapping the fixed one would drag the box sideways while you
  // were trying to make it wider.
  const guides = []
  const others = opts?.others
  if (others && others.length && !opts?.disableSnap) {
    const tolerance = opts?.tolerance ?? SNAP_TOLERANCE
    const targets = others.map(linesOf)
    const targetX = targets.flatMap((t) => t.x)
    const targetY = targets.flatMap((t) => t.y)

    if (h.x === 0) {
      const snap = nearestSnap([{ at: x }], targetX, tolerance)
      if (snap) { const right = x + w; x += snap.delta; w = right - x; guides.push({ axis: 'x', at: snap.line }) }
    } else if (h.x === 1) {
      const snap = nearestSnap([{ at: x + w }], targetX, tolerance)
      if (snap) { w += snap.delta; guides.push({ axis: 'x', at: snap.line }) }
    }

    if (h.y === 0) {
      const snap = nearestSnap([{ at: y }], targetY, tolerance)
      if (snap) { const bottom = y + hgt; y += snap.delta; hgt = bottom - y; guides.push({ axis: 'y', at: snap.line }) }
    } else if (h.y === 1) {
      const snap = nearestSnap([{ at: y + hgt }], targetY, tolerance)
      if (snap) { hgt += snap.delta; guides.push({ axis: 'y', at: snap.line }) }
    }
  }

  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    w: Math.round(Math.max(min.w, w)),
    h: Math.round(Math.max(min.h, hgt)),
    guides
  }
}

/**
 * The canvas has to be at least big enough to hold everything on it.
 *
 * @param padding  a number, or { x, y } when the room wanted to the right
 *                 differs from the room wanted below
 */
export function canvasBounds(rects, padding) {
  const pad = padding ?? 80
  const padX = typeof pad === 'object' ? pad.x || 0 : pad
  const padY = typeof pad === 'object' ? pad.y || 0 : pad
  let width = 0
  let height = 0
  for (const item of rects || []) {
    const r = rectOf(item)
    width = Math.max(width, r.x + r.w)
    height = Math.max(height, r.y + r.h)
  }
  return { width: width + padX, height: height + padY }
}

/**
 * Raises `id` above the rest.
 *
 * Renumbered from zero rather than "max + 1" so z never climbs forever — a
 * board that is rearranged for a year would otherwise carry meaningless
 * five-digit z values, and their ORDER is the only thing that matters.
 */
export function bringToFront(items, id) {
  const others = (items || []).filter((item) => item.id !== id)
  const target = (items || []).find((item) => item.id === id)
  if (!target) return items || []
  const ordered = [...others].sort((a, b) => (a.z || 0) - (b.z || 0))
  const renumbered = ordered.map((item, i) => ({ ...item, z: i }))
  return [...renumbered, { ...target, z: renumbered.length }]
}

/** Items in paint order — the one on top renders last. */
export function inStackOrder(items) {
  return [...(items || [])].sort((a, b) => (a.z || 0) - (b.z || 0))
}

/** A new item: a bit under half the width, a third of the height. */
export const DEFAULT_FRACTION = { w: 0.45, h: 0.35 }

/** A pixel rect → fractions of the canvas, clamped to stay on it. */
export function toFraction(rect, canvas) {
  const cw = canvas?.width || 1
  const ch = canvas?.height || 1
  // Size first: the position clamp below depends on it.
  const w = clamp01((rect.w || 0) / cw)
  // An item may be TALLER than one page — a long table is a reasonable thing
  // to place — so height is not capped at 1 either.
  const h = Math.max(0, (rect.h || 0) / ch)
  return {
    // x + w never exceeds 1, so an item cannot be placed where the canvas
    // does not reach sideways — which with fractions would be nowhere at all.
    x: clamp(0, 1 - w, (rect.x || 0) / cw),
    // NOT clamped to one page. The canvas grows downward to hold whatever is
    // placed on it.
    y: Math.max(0, (rect.y || 0) / ch),
    w, h
  }
}

/** Fractions → a pixel rect on the canvas. */
export function toPixels(fraction, canvas) {
  const cw = canvas?.width || 0
  const ch = canvas?.height || 0
  return {
    x: Math.round((fraction.x || 0) * cw),
    y: Math.round((fraction.y || 0) * ch),
    // An item with no stored size gets a readable default rather than
    // collapsing to nothing.
    w: Math.round((fraction.w || DEFAULT_FRACTION.w) * cw),
    h: Math.round((fraction.h || DEFAULT_FRACTION.h) * ch)
  }
}

/**
 * Every rect the band touches, by id.
 *
 * TOUCHES, not encloses. Requiring full containment means a band drawn across
 * a row of wide cards selects nothing, and the user has to start outside the
 * board and sweep the lot — which is the behaviour people complain about in
 * every tool that chooses it.
 *
 * @param rects  [{ id, x, y, w, h }] in pixels
 */
export function hits(rects, band) {
  return (rects || []).filter((r) => overlaps(r, band)).map((r) => r.id)
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function clamp01(v) { return clamp(0, 1, v) }
function clamp(min, max, v) {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, v))
}
