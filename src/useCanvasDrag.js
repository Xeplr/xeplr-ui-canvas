import { useCallback, useLayoutEffect, useRef } from 'react'
import { moveRect, resizeRect, pixelRect, GRID } from './geometry.js'
import { createFrameStore } from './frameStore.js'
import { NOT_A_DRAG } from './press.js'

// Dragging and resizing on a canvas. The geometry is in geometry.js; this owns
// only the pointer lifecycle.
//
// Three things it deliberately does:
//
// Listeners go on the DOCUMENT, not the item. A drag that ends when the
// pointer leaves the element is a drag that breaks the moment you move
// quickly — which is exactly when you are moving something a long way.
//
// NOTHING RE-RENDERS DURING A DRAG. A frame writes `transform` (or, for
// resize, the box) straight onto the dragged item's own DOM element and
// publishes guides and live positions through a frame store, which only the
// overlays (guides, edges) subscribe to. React learns the new position exactly
// once, on drop. Everything else on the canvas is untouched, whatever the item
// count.
//
// Moves are COALESCED INTO ONE FRAME. The OS delivers mousemove faster than
// the display refreshes, so the work is done in a rAF and the extra events
// collapse into the frame that is already pending.
//
// Items are found by the `data-canvas-item-id` attribute on their element,
// inside `rootRef` when given (so two canvases on a page never find each
// other's items).

export const ITEM_ID_ATTR = 'data-canvas-item-id'

const EMPTY_FRAME = { guides: [], rect: null, mode: null, patches: null }

/**
 * @param items          the items on the canvas: { id, x, y, w, h, ... }
 * @param units          'px' (default) or 'fraction' — see geometry.js
 * @param canvas         measured { width, height }; needed for 'fraction'
 * @param rootRef        the canvas element, to scope the item lookup
 * @param onUpdate       (id, patch) — called once per moved item, on drop, in
 *                       PIXELS; a fractional caller converts
 * @param onRaise        (id) — optional, on grab
 * @param onClick        (id, event) — optional, when the pointer never moved
 *                       past clickThreshold
 * @param minSizeFor     (item) → { minWidth, minHeight } — optional, per item
 * @param snap           false turns alignment snapping and the grid off
 * @param grid           grid fallback spacing in px; 0 for none
 * @param clickThreshold px the pointer must move before it counts as a drag.
 *                       0 (default) commits any movement at all.
 */
export function useCanvasDrag({
  items, units, canvas, rootRef, onUpdate, onRaise, onClick, minSizeFor,
  snap = true, grid = GRID, clickThreshold = 0
}) {
  const stateRef = useRef(null)
  // The listeners are added and removed by identity, so they have to be the
  // same function objects across a drag — refs rather than callbacks, whose
  // identity changes whenever `items` does.
  const moveRef = useRef(null)
  const endRef = useRef(null)

  // One store per hook instance. It carries the live RECT and per-item
  // PATCHES as well as the guides: a ruler has to show where the thing
  // currently is, and an edge has to follow the item it is attached to.
  const storeRef = useRef(null)
  if (!storeRef.current) storeRef.current = createFrameStore(EMPTY_FRAME)
  const store = storeRef.current

  // Nodes whose inline drag styles are waiting to be handed back to React.
  const pendingClearRef = useRef(null)

  // ONLY `transform`, and that is not a detail.
  //
  // left/top/width/height are REACT'S — the item writes them from its own
  // rect. Clearing them here wiped the item's position, and React does not
  // put it back: its style diff only writes properties whose value CHANGED
  // between renders, so a committed position that round-trips to the pixels
  // it already rendered writes nothing at all.
  //
  // `transform` is the one property this file owns and React never sets, so
  // it is the only one safe to reset. A resize writes the box directly, and
  // React overwrites it on commit — those values genuinely changed.
  function clearNodes(nodes) {
    nodes.forEach((n) => { if (n) n.style.transform = '' })
  }

  // Cleared AFTER the commit has rendered, in a layout effect, so the element
  // never paints a frame at its pre-drag position: React has already written
  // the new left/top by the time the transform comes off. The live patches
  // are dropped at the same moment, for the same reason — an edge must not
  // flick back to the old position for the frame between drop and commit.
  useLayoutEffect(() => {
    if (!pendingClearRef.current) return
    clearNodes(pendingClearRef.current)
    pendingClearRef.current = null
    store.publish(EMPTY_FRAME)
  }, [items, store])

  const begin = useCallback((e, ids, mode, handle) => {
    // Only the primary button, and never through a control inside the item —
    // a Remove button can sit in the drag handle, and so can the field that
    // names the item. The preventDefault below is what takes the press for
    // the drag, and for a field that same default is the focus; press.js has
    // the list and the reasoning.
    if (e.button !== 0) return
    if (e.target.closest && e.target.closest(NOT_A_DRAG)) return
    e.preventDefault()
    e.stopPropagation()

    // MOVE can carry a whole selection; RESIZE is always exactly one item —
    // this just normalizes both callers to the same shape.
    const idList = Array.isArray(ids) ? ids : [ids]
    const members = idList.map((id) => items.find((w) => w.id === id)).filter(Boolean)
    if (!members.length) return

    // Pixels throughout the drag, because a mouse moves in pixels. Fractions
    // are converted back by the caller, once, on drop.
    const rectOf = (w) => pixelRect(w, units, canvas)
    const memberIdSet = new Set(idList)
    const others = items.filter((w) => !memberIdSet.has(w.id)).map(rectOf)
    // Looked up ONCE. A per-frame querySelector would put a DOM search in the
    // hot path.
    const root = (rootRef && rootRef.current) || document
    const memberRects = members.map((w) => ({
      id: w.id,
      item: w,
      rect: rectOf(w),
      node: root.querySelector(`[${ITEM_ID_ATTR}="${CSS.escape(String(w.id))}"]`)
    }))
    stateRef.current = {
      ids: idList, mode, handle, others, memberRects,
      startX: e.clientX, startY: e.clientY,
      rect: memberRects[0].rect,
      minSize: minSizeFor ? minSizeFor(members[0]) : null,
      moved: false,
      last: null,
      pendingEvent: null,
      raf: 0
    }

    function paint() {
      const s = stateRef.current
      if (!s) return
      s.raf = 0
      const ev = s.pendingEvent
      if (!ev) return
      s.pendingEvent = null

      const dx = ev.clientX - s.startX
      const dy = ev.clientY - s.startY

      // Below the threshold it is still a click. Checked only until the
      // pointer first leaves it — a drag that comes back near its start is
      // still a drag.
      if (!s.moved) {
        if (clickThreshold > 0 && Math.abs(dx) <= clickThreshold && Math.abs(dy) <= clickThreshold) return
        s.moved = true
      }
      // Alt overrules the snapping — the point of a free canvas is that it
      // can always be overruled.
      const disableSnap = !snap || ev.altKey

      if (s.mode === 'move') {
        if (s.memberRects.length > 1) {
          // Group move: everyone shifts by the same raw delta. No alignment
          // snapping here — moving several things as one unit is the point,
          // not lining any one of them up against something else.
          const patches = s.memberRects.map((m) => ({
            id: m.id,
            x: Math.max(0, Math.round(m.rect.x + dx)),
            y: Math.max(0, Math.round(m.rect.y + dy))
          }))
          s.last = patches
          s.memberRects.forEach((m, i) => {
            if (!m.node) return
            m.node.style.transform =
              `translate3d(${patches[i].x - m.rect.x}px, ${patches[i].y - m.rect.y}px, 0)`
          })
          store.publish({ guides: [], rect: boundsOf(s.memberRects, patches), mode: 'move', patches })
          return
        }

        const m = s.memberRects[0]
        const { x, y, guides } = moveRect(s.rect, s.rect.x + dx, s.rect.y + dy, s.others, { disableSnap, grid })
        s.last = [{ id: s.ids[0], x, y }]
        if (m.node) m.node.style.transform = `translate3d(${x - m.rect.x}px, ${y - m.rect.y}px, 0)`
        store.publish({ guides, rect: { x, y, w: m.rect.w, h: m.rect.h }, mode: 'move', patches: s.last })
        return
      }

      // The minimum is per ITEM, not global: a chart has a real floor, a
      // one-pixel rule does not.
      const next = resizeRect(s.rect, s.handle, dx, dy,
        Object.assign({}, s.minSize, { others: s.others, disableSnap }))
      const { guides: resizeGuides, ...box } = next
      s.last = [{ id: s.ids[0], ...box }]
      // A resize changes the box, which no transform can express — so this
      // one writes the box itself. Still the dragged node only.
      const node = s.memberRects[0].node
      if (node) {
        node.style.left = `${box.x}px`
        node.style.top = `${box.y}px`
        node.style.width = `${box.w}px`
        node.style.height = `${box.h}px`
      }
      store.publish({ guides: resizeGuides, rect: box, mode: 'resize', patches: s.last })
    }

    function onMove(ev) {
      const s = stateRef.current
      if (!s) return
      s.pendingEvent = ev
      if (!s.raf) s.raf = requestAnimationFrame(paint)
    }

    function onEnd(ev) {
      const s = stateRef.current
      stateRef.current = null
      document.removeEventListener('mousemove', moveRef.current)
      document.removeEventListener('mouseup', endRef.current)
      if (!s) return
      if (s.raf) cancelAnimationFrame(s.raf)
      // The frame the pointer stopped on may still be queued; apply it, or
      // the drop would commit the position from one frame earlier.
      if (s.pendingEvent) { stateRef.current = s; s.raf = 0; paint(); stateRef.current = null }

      const nodes = s.memberRects.map((m) => m.node)
      if (!s.last) {
        // A click, not a drag: nothing was written, so nothing has to wait
        // for a commit that is not coming.
        store.publish(EMPTY_FRAME)
        clearNodes(nodes)
        if (onClick) onClick(s.ids[0], ev)
        return
      }
      // Guides off now; the live patches stay until the commit renders (see
      // the layout effect above).
      store.publish({ guides: [], rect: null, mode: null, patches: s.last })
      // The committing write(s). Everything before it went to the DOM only.
      pendingClearRef.current = nodes
      s.last.forEach((p) => { const { id, ...patch } = p; onUpdate(id, patch) })
    }

    moveRef.current = onMove
    endRef.current = onEnd
    idList.forEach((id) => onRaise?.(id))
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
  }, [items, units, canvas, rootRef, onUpdate, onRaise, onClick, minSizeFor, snap, grid, clickThreshold, store])

  return {
    // Read by the overlays alone — DragGuides, EdgeLayer.
    guideStore: store,
    startDrag: (e, ids) => begin(e, ids, 'move'),
    startResize: (e, id, handle) => begin(e, id, 'resize', handle)
  }
}

// The rectangle enclosing every member at its patched position.
function boundsOf(memberRects, patches) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  memberRects.forEach((m, i) => {
    minX = Math.min(minX, patches[i].x)
    minY = Math.min(minY, patches[i].y)
    maxX = Math.max(maxX, patches[i].x + m.rect.w)
    maxY = Math.max(maxY, patches[i].y + m.rect.h)
  })
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
