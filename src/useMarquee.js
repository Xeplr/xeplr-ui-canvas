import { useCallback, useRef } from 'react'
import { hits, pixelRect } from './geometry.js'
import { createFrameStore } from './frameStore.js'

// MARQUEE SELECT — drag a box on bare canvas, take everything it touches.
//
// ── WHY THIS IS ALSO THE ANSWER TO Z-INDEX ───────────────────────────────
//
// Clicking selects whatever is on top: an item under another cannot be
// reached at all, because the pointer never gets to it. A marquee does not
// hit-test — it compares RECTANGLES, so an occluded item is selected by
// exactly the same arithmetic as one in the open.
//
// ── AND WHY THE CANVAS DOES NOT CLEAR ON MOUSEDOWN ───────────────────────
//
// That is the gesture a marquee starts with, so the natural sweep would
// destroy the selection before it drew anything. Clearing happens on mouseUP,
// and only if the pointer never really moved — a click on bare canvas still
// means "deselect", a drag means "select these".
//
// Nothing re-renders while the band is drawn: the rect goes to a store that
// only MarqueeBox subscribes to, and moves coalesce into one rAF — the same
// bargain useCanvasDrag makes, for the same reason.

/** Below this, it was a click and not a drag. */
const THRESHOLD = 4

/** On <body> while a sweep is live — see canvas.css. */
export const SWEEPING_CLASS = 'xeplr-canvas-sweeping'

/**
 * @param items        the items on the canvas
 * @param units        'px' (default) or 'fraction'
 * @param canvas       measured { width, height }; needed for 'fraction'
 * @param canvasElRef  the element the band is drawn in
 * @param onSelect     (ids, additive) — on mouseup after a sweep
 * @param onClear      () — on a click on bare canvas
 */
export function useMarquee({ items, units, canvas, canvasElRef, onSelect, onClear }) {
  const stateRef = useRef(null)
  const moveRef = useRef(null)
  const endRef = useRef(null)
  const storeRef = useRef(null)
  if (!storeRef.current) storeRef.current = createFrameStore({ rect: null })
  const store = storeRef.current

  const begin = useCallback((e) => {
    // Only the primary button, and only on the canvas ITSELF — a mousedown
    // that started on an item is that item's drag, not a marquee.
    if (e.button !== 0 || e.target !== e.currentTarget) return
    const el = canvasElRef.current
    if (!el) return

    // THE BROWSER'S OWN SELECTION, SUPPRESSED.
    //
    // A bare mousedown followed by a drag is also how you highlight text, so
    // sweeping a band across a table item selected its CELLS. The only thing
    // a canvas selects is items. preventDefault stops the selection starting;
    // the body class stops it being started by anything else while the sweep
    // is live.
    e.preventDefault()
    document.body.classList.add(SWEEPING_CLASS)
    const sel = window.getSelection && window.getSelection()
    if (sel && sel.rangeCount) sel.removeAllRanges()

    const box = el.getBoundingClientRect()
    const origin = { x: e.clientX - box.left, y: e.clientY - box.top }
    stateRef.current = {
      origin,
      box,
      // Held at the START. A modifier picked up later would turn a replace
      // into an add halfway through, which is not something anyone means.
      additive: Boolean(e.ctrlKey || e.metaKey || e.shiftKey),
      moved: false,
      pendingEvent: null,
      raf: 0,
      rect: null
    }

    function paint() {
      const s = stateRef.current
      if (!s) return
      s.raf = 0
      const ev = s.pendingEvent
      if (!ev) return
      s.pendingEvent = null

      const x = ev.clientX - s.box.left
      const y = ev.clientY - s.box.top
      // Normalised, so dragging up and left works exactly like down and right.
      s.rect = {
        x: Math.min(s.origin.x, x),
        y: Math.min(s.origin.y, y),
        w: Math.abs(x - s.origin.x),
        h: Math.abs(y - s.origin.y)
      }
      if (s.rect.w > THRESHOLD || s.rect.h > THRESHOLD) s.moved = true
      if (s.moved) store.publish({ rect: s.rect })
    }

    function onMove(ev) {
      const s = stateRef.current
      if (!s) return
      s.pendingEvent = ev
      if (!s.raf) s.raf = requestAnimationFrame(paint)
    }

    function onEnd() {
      const s = stateRef.current
      stateRef.current = null
      document.body.classList.remove(SWEEPING_CLASS)
      document.removeEventListener('mousemove', moveRef.current)
      document.removeEventListener('mouseup', endRef.current)
      if (!s) return
      if (s.raf) cancelAnimationFrame(s.raf)
      store.publish({ rect: null })

      // A click on bare canvas still deselects.
      if (!s.moved || !s.rect) { onClear(); return }
      // A fractional canvas not measured yet has nothing on it to hit.
      if (units === 'fraction' && !canvas) { onSelect([], s.additive); return }
      const rects = items.map((w) => ({ id: w.id, ...pixelRect(w, units, canvas) }))
      onSelect(hits(rects, s.rect), s.additive)
    }

    moveRef.current = onMove
    endRef.current = onEnd
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
  }, [items, units, canvas, canvasElRef, onSelect, onClear, store])

  return { onMouseDown: begin, marqueeStore: store }
}
