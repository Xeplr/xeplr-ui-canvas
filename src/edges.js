// Edges — the lines between items on a canvas that links things (workflow
// transitions, dataset joins). Pure: points in, SVG path data out.
//
// The workflow and dataset canvases each drew their own near-identical
// bezier; this is the one both use now.

/** The middle of one side of a rect — where an edge leaves or arrives. */
export function anchorOf(rect, side) {
  switch (side) {
    case 'left': return { x: rect.x, y: rect.y + rect.h / 2 }
    case 'top': return { x: rect.x + rect.w / 2, y: rect.y }
    case 'bottom': return { x: rect.x + rect.w / 2, y: rect.y + rect.h }
    case 'right':
    default: return { x: rect.x + rect.w, y: rect.y + rect.h / 2 }
  }
}

/**
 * A horizontal S-curve from `from` to `to`.
 *
 * The control points reach out sideways by half the horizontal gap, but never
 * less than `minOffset` — two boxes stacked almost vertically would otherwise
 * be joined by a straight line that runs through both of them.
 *
 * `fromDir` / `toDir` (+1 right, -1 left) say which way the line leaves and
 * arrives. The defaults are the usual left-to-right flow; a join between two
 * right-hand ports passes fromDir 1, toDir 1 to loop back round.
 */
export function bezierPath(from, to, opts) {
  const minOffset = opts?.minOffset ?? 60
  const fromDir = opts?.fromDir ?? 1
  const toDir = opts?.toDir ?? -1
  const dx = Math.max(minOffset, Math.abs(to.x - from.x) / 2)
  return 'M ' + from.x + ' ' + from.y +
    ' C ' + (from.x + fromDir * dx) + ' ' + from.y +
    ', ' + (to.x + toDir * dx) + ' ' + to.y +
    ', ' + to.x + ' ' + to.y
}

/** Where a label on an edge sits. */
export function midpoint(from, to) {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
}

/**
 * The two ends of one edge, in pixels.
 *
 * `edge.to` is an item id; `edge.toOffset` instead ends the edge at a point
 * relative to where it leaves — for a target that is not an item, like the
 * workflow's Success/Failed pills. Relative, so it follows its item while it
 * is dragged.
 *
 * @param rectById  id → pixel rect (live positions during a drag)
 * @param getAnchor optional (item, port, end, rect) → { x, y }, for canvases
 *                  whose edges attach to ports inside an item (column dots)
 * @returns {{ from, to }|null} null when either end is not on the canvas
 */
export function edgeEnds(edge, rectById, itemById, getAnchor) {
  const fromRect = rectById[edge.from]
  if (!fromRect) return null
  const from = getAnchor
    ? getAnchor(itemById[edge.from], edge.fromPort, 'from', fromRect)
    : anchorOf(fromRect, edge.fromSide || 'right')
  if (edge.toOffset) {
    return { from, to: { x: from.x + (edge.toOffset.x || 0), y: from.y + (edge.toOffset.y || 0) } }
  }
  const toRect = rectById[edge.to]
  if (!toRect) return null
  const to = getAnchor
    ? getAnchor(itemById[edge.to], edge.toPort, 'to', toRect)
    : anchorOf(toRect, edge.toSide || 'left')
  return { from, to }
}
