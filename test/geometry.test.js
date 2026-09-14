// Free-canvas geometry — moving, resizing, snapping, stacking, fractions.
//
// Free placement was chosen over a snap grid, which means "roughly aligned"
// is the natural result of dragging. Alignment snapping is what pays for that
// choice, so most of this is about snapping being right: it has to fire when
// you meant it and stay out of the way when you didn't.
import { GRID,
  moveRect, resizeRect, rectOf, canvasBounds,
  bringToFront, inStackOrder, MIN_WIDTH, MIN_HEIGHT, SNAP_TOLERANCE,
  toFraction, toPixels, DEFAULT_FRACTION, hits
} from '../src/geometry.js'
import { anchorOf, bezierPath, midpoint, edgeEnds } from '../src/edges.js'


const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }

const rect = (x, y, w, h) => ({ x, y, w, h })
const BOX = rect(100, 100, 200, 200)

console.log('\nmoving')
check('with nothing to snap to, it goes where you put it',
  JSON.stringify(moveRect(BOX, 300, 250, [])) === JSON.stringify({ x: 300, y: 250, guides: [] }))
// Off-canvas is unreachable — no scrollbar goes to -40.
check('negative coordinates are clamped to the edge',
  moveRect(BOX, -40, -10, []).x === 0 && moveRect(BOX, -40, -10, []).y === 0)
check('positions are whole pixels', Number.isInteger(moveRect(BOX, 10.7, 20.2, []).x))

console.log('\nsnapping')
{
  const other = rect(400, 100, 200, 200)
  // Left edge lands 3px from the other's left — within tolerance, so it takes it.
  const out = moveRect(BOX, 403, 250, [other])
  check('a near-miss on an edge snaps exactly', out.x === 400)
  check('...and reports the guide so the jump is explainable',
    out.guides.some((g) => g.axis === 'x' && g.at === 400))
}
{
  const other = rect(400, 100, 200, 200)
  // 20px away is a position someone chose, not one they missed.
  check('a clear miss is left alone', moveRect(BOX, 380, 250, [other]).x === 380)
}
{
  // The RIGHT edge meeting another's LEFT edge — the widget moves, not just
  // the edge, so the whole box has to shift by the difference.
  const other = rect(500, 100, 200, 200)
  const out = moveRect(BOX, 298, 250, [other])
  check('a right edge snaps to a left edge, moving the whole box', out.x === 300)
}
{
  // Centres line up too, which is how two stacked widgets get centred on
  // each other without either edge matching.
  const other = rect(0, 400, 400, 100)
  const out = moveRect(BOX, 98, 600, [other])
  check('centres snap to centres', out.x + 100 === 200)
}
{
  const other = rect(400, 400, 200, 200)
  const out = moveRect(BOX, 402, 403, [other])
  check('both axes can snap at once', out.x === 400 && out.y === 400)
  check('...with a guide for each', out.guides.length === 2)
}
{
  // Alt held: a free canvas has to stay free.
  const other = rect(400, 100, 200, 200)
  check('snapping can be overruled',
    moveRect(BOX, 403, 250, [other], { disableSnap: true }).x === 403)
}
{
  // The nearest wins, or a crowded board snaps to whichever happened to be
  // first in the list.
  const near = rect(405, 0, 10, 10)
  const nearer = rect(402, 0, 10, 10)
  check('the closest candidate wins', moveRect(BOX, 403, 0, [near, nearer]).x === 402)
}
{
  // A WIDE target, deliberately: a narrow one's centre sits within tolerance
  // of its own left edge, so the boundary being tested would be decided by
  // the centre line instead of the edge.
  const wide = rect(400, 0, 200, 10)
  check('at exactly the tolerance it still snaps',
    moveRect(BOX, 400 + SNAP_TOLERANCE, 0, [wide]).x === 400)
  // CHANGED WITH THE GRID. Out of alignment range it no longer stays exactly
  // where the pointer left it — it falls back to the nearest grid line, which
  // is the whole point of having one. 407 -> 410.
  check('...and one pixel further it falls back to the grid',
    moveRect(BOX, 400 + SNAP_TOLERANCE + 1, 0, [wide]).x
      === Math.round((400 + SNAP_TOLERANCE + 1) / GRID) * GRID)

  // PRECEDENCE, and it matters: a widget lined up with its neighbour must not
  // then be dragged off that edge by the grid. 400 is not on a 10px boundary
  // here only by luck, so use an edge that is deliberately off-grid.
  const offGrid = rect(403, 0, 200, 10)
  check('alignment beats the grid',
    moveRect(BOX, 403 + 2, 0, [offGrid]).x === 403)

  // And alt still means what it always meant: neither of them.
  check('alt gives genuinely free placement',
    moveRect(BOX, 407, 0, [wide], { disableSnap: true }).x === 407)
}
{
  // The centre IS a snap target, so a narrow neighbour offers three lines
  // close together and the nearest one wins — 405 here, not 400.
  const narrow = rect(400, 0, 10, 10)
  check('a narrow target snaps to its centre when that is nearer',
    moveRect(BOX, 406, 0, [narrow]).x === 405)
}

console.log('\nresizing')
// Compare the BOX, not the whole return value. resizeRect now also reports
// the guides it snapped to — the same shape moveRect has always returned —
// and a JSON.stringify of the lot would fail every time a field is added
// without anything about the geometry having changed.
const box = (r) => JSON.stringify({ x: r.x, y: r.y, w: r.w, h: r.h })
check('the east handle grows the width only',
  box(resizeRect(BOX, 'e', 50, 0)) === JSON.stringify({ x: 100, y: 100, w: 250, h: 200 }))
check('the south handle grows the height only',
  box(resizeRect(BOX, 's', 0, 50)) === JSON.stringify({ x: 100, y: 100, w: 200, h: 250 }))
{
  // Dragging the west edge right shrinks the box; the RIGHT edge must not
  // move. 30px, not 50 — 50 would take the width under MIN_WIDTH and the
  // clamp, not the handle, would be what this measured.
  const out = resizeRect(BOX, 'w', 30, 0)
  check('the west handle keeps the right edge fixed', out.x === 130 && out.x + out.w === 300)
}
{
  const out = resizeRect(BOX, 'n', 0, 50)
  check('the north handle keeps the bottom fixed', out.y === 150 && out.y + out.h === 300)
}
check('a corner moves both axes',
  box(resizeRect(BOX, 'se', 40, 30)) === JSON.stringify({ x: 100, y: 100, w: 240, h: 230 }))

{
  // GUIDES ON RESIZE — the gesture that never had them. Only the edge being
  // dragged snaps: grabbing 'e' must not shift the left edge.
  const neighbour = rect(352, 0, 100, 10)
  const out = resizeRect(BOX, 'e', 50, 0, { others: [neighbour] })
  check('a resized edge snaps to a neighbour', out.x + out.w === 352)
  check('...and says what it snapped to', out.guides.length === 1 && out.guides[0].axis === 'x')
  check('...while the fixed edge stays put', out.x === 100)

  const free = resizeRect(BOX, 'e', 50, 0, { others: [neighbour], disableSnap: true })
  check('alt turns resize snapping off too', free.x + free.w === 350 && free.guides.length === 0)
}


console.log('\nresizing cannot invert')
// Dragging an edge past its opposite would give a negative size, which is
// not a shape anything can render.
check('the east handle stops at the minimum width', resizeRect(BOX, 'e', -9999, 0).w === MIN_WIDTH)
check('the south handle stops at the minimum height', resizeRect(BOX, 's', 0, -9999).h === MIN_HEIGHT)
{
  const out = resizeRect(BOX, 'w', 9999, 0)
  check('the west handle stops without crossing the right edge', out.w === MIN_WIDTH && out.x + out.w === 300)
}
{
  const out = resizeRect(BOX, 'n', 0, 9999)
  check('the north handle stops without crossing the bottom', out.h === MIN_HEIGHT && out.y + out.h === 300)
}
check('an unknown handle changes nothing',
  JSON.stringify(resizeRect(BOX, 'nope', 50, 50)) === JSON.stringify(BOX))

console.log('\nthe minimum can be the caller\'s')
{
  const HAIRLINE = { minWidth: 8, minHeight: 2 }
  const line = rect(100, 100, 300, 2)
  check('without a minimum, a line is forced to the default floor', resizeRect(line, 's', 0, -9999).h === MIN_HEIGHT)
  check('with its own minimum it stays a hairline', resizeRect(line, 's', 0, -9999, HAIRLINE).h === 2)
}

console.log('\nthe canvas grows to fit')
{
  const bounds = canvasBounds([{ x: 0, y: 0, w: 100, h: 100 }, { x: 500, y: 300, w: 200, h: 200 }], 80)
  check('bounded by the furthest widget', bounds.width === 780 && bounds.height === 580)
  check('an empty canvas still has room to drop something into',
    canvasBounds([], 80).width === 80)
}

console.log('\nstacking')
{
  const list = [{ id: 'a', z: 0 }, { id: 'b', z: 1 }, { id: 'c', z: 2 }]
  const raised = bringToFront(list, 'a')
  check('the raised one ends up on top', raised.find((w) => w.id === 'a').z === 2)
  check('...and the others keep their relative order',
    raised.find((w) => w.id === 'b').z < raised.find((w) => w.id === 'c').z)
  // Renumbered from zero rather than max+1, or a board rearranged for a year
  // carries meaningless five-digit z values.
  check('z values stay small',
    Math.max(...bringToFront([{ id: 'a', z: 9999 }, { id: 'b', z: 5 }], 'b').map((w) => w.z)) === 1)
  check('raising something absent changes nothing', bringToFront(list, 'zzz').length === 3)
}
check('paint order is by z',
  inStackOrder([{ id: 'a', z: 2 }, { id: 'b', z: 0 }]).map((w) => w.id).join() === 'b,a')
check('a widget with no z sorts as zero, not last',
  inStackOrder([{ id: 'a', z: 1 }, { id: 'b' }]).map((w) => w.id).join() === 'b,a')

console.log('\nfractions of the canvas')
{
  const CANVAS = { width: 1000, height: 500 }
  check('pixels become fractions',
    JSON.stringify(toFraction({ x: 100, y: 50, w: 500, h: 250 }, CANVAS)) ===
    JSON.stringify({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }))
  check('...and back again',
    JSON.stringify(toPixels({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, CANVAS)) ===
    JSON.stringify({ x: 100, y: 50, w: 500, h: 250 }))

  // The point of the whole change: the same stored widget on a bigger
  // screen is bigger, in the same place proportionally.
  const stored = toFraction({ x: 100, y: 50, w: 500, h: 250 }, CANVAS)
  const wider = toPixels(stored, { width: 2000, height: 1000 })
  check('a board scales with the screen', wider.w === 1000 && wider.x === 200)
}
{
  const CANVAS = { width: 1000, height: 500 }
  // A fraction over 1 is a widget nobody can reach, and unlike pixels there
  // is no scrollbar that would find it.
  check('nothing can be placed off the canvas',
    toFraction({ x: 5000, y: 5000, w: 100, h: 100 }, CANVAS).x <= 1)
  check('...or sized beyond it', toFraction({ x: 0, y: 0, w: 9999, h: 9999 }, CANVAS).w === 1)
  check('a full-width widget sits at the left edge',
    toFraction({ x: 400, y: 0, w: 1000, h: 100 }, CANVAS).x === 0)
  check('negatives clamp to the origin', toFraction({ x: -50, y: -50, w: 100, h: 100 }, CANVAS).x === 0)
}
{
  // A hidden tab measures 0x0, and dividing by it must not produce NaN —
  // which would render as no style at all and collapse every widget.
  check('a zero canvas does not produce NaN',
    Number.isFinite(toFraction({ x: 10, y: 10, w: 10, h: 10 }, { width: 0, height: 0 }).x))
  check('a missing canvas is survivable', Number.isFinite(toPixels({ x: 0.5 }, null).x))
  // A board saved before fractions existed has no size at all.
  check('no stored size falls back to a readable default',
    toPixels({ x: 0, y: 0 }, { width: 1000, height: 500 }).w === Math.round(DEFAULT_FRACTION.w * 1000))
}

console.log('\ny is no longer trapped on one page')
{
  const canvas = { width: 1000, height: 600 }
  // Dropped a page and a half down: 900px on a 600px page.
  const f = toFraction({ x: 100, y: 900, w: 400, h: 200 }, canvas)
  check('a widget dragged below the fold keeps its position', Math.abs(f.y - 1.5) < 1e-9)
  check('...and converts back to the same pixels', toPixels(f, canvas).y === 900)
  // Sideways is still bounded: there is no horizontal scroll to find it in.
  const wide = toFraction({ x: 900, y: 0, w: 400, h: 200 }, canvas)
  check('x is still clamped inside the canvas', wide.x + wide.w <= 1 + 1e-9)
}

console.log('\ndefaults')
check('a widget with no size gets one', rectOf({ x: 5, y: 5 }).w > 0)
check('a widget with no position starts at the origin', rectOf({}).x === 0)
console.log('\nmarquee hits')
{
  const rects = [{ id: 'a', ...rect(0, 0, 100, 100) }, { id: 'b', ...rect(300, 300, 100, 100) }]
  check('a band touching an edge takes it — touch, not enclose',
    hits(rects, rect(90, 90, 20, 20)).join() === 'a')
  check('a band over nothing takes nothing', hits(rects, rect(150, 150, 50, 50)).length === 0)
  check('a band across both takes both', hits(rects, rect(50, 50, 300, 300)).join() === 'a,b')
}

console.log('\nedges')
{
  const r = rect(100, 100, 200, 80)
  check('the right anchor is the middle of the right side',
    JSON.stringify(anchorOf(r, 'right')) === JSON.stringify({ x: 300, y: 140 }))
  check('the left anchor is the middle of the left side',
    JSON.stringify(anchorOf(r, 'left')) === JSON.stringify({ x: 100, y: 140 }))
  // The workflow's old bezierPath, byte for byte: reach out by half the gap.
  check('a curve reaches out by half the gap',
    bezierPath({ x: 0, y: 0 }, { x: 400, y: 100 }) === 'M 0 0 C 200 0, 200 100, 400 100')
  // Two boxes almost stacked would otherwise join with a line through both.
  check('...but never less than the minimum',
    bezierPath({ x: 0, y: 0 }, { x: 10, y: 100 }, { minOffset: 40 }) === 'M 0 0 C 40 0, -30 100, 10 100')
  check('a label sits at the midpoint', midpoint({ x: 0, y: 0 }, { x: 10, y: 20 }).y === 10)

  const rectById = { a: rect(0, 0, 100, 50), b: rect(300, 0, 100, 50) }
  const ends = edgeEnds({ from: 'a', to: 'b' }, rectById, {})
  check('an edge leaves the right of one item and enters the left of the next',
    ends.from.x === 100 && ends.to.x === 300)
  check('an edge to something not on the canvas is not drawn', edgeEnds({ from: 'a', to: 'zzz' }, rectById, {}) === null)
  const stub = edgeEnds({ from: 'a', toOffset: { x: 130, y: 0 } }, rectById, {})
  check('a toOffset ends relative to where the edge leaves', stub.to.x === 230 && stub.to.y === 25)
  const ported = edgeEnds({ from: 'a', to: 'b', fromPort: 'id' }, rectById, { a: {}, b: {} },
    (item, port, end, rr) => ({ x: rr.x, y: port === 'id' ? 7 : 0 }))
  check('getAnchor decides where a port edge attaches', ported.from.y === 7 && ported.to.x === 300)
}


const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
